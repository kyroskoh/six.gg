/**
 * @typedef {import("express").Request} Express.Request
 * @typedef {import("express").Response} Express.Response
 */

const Event = require("../../src/models/event"),
    Log = require("../../src/logging/log"),
    tc = require("timezonecomplete"),
    Time = require("../../src/time"),
    User = require("../../src/models/user");

//  #####                        #              #             #
//  #                            #             # #
//  #      #   #   ###   # ##   ####    ###   #   #  # ##    ##
//  ####   #   #  #   #  ##  #   #     #      #   #  ##  #    #
//  #       # #   #####  #   #   #      ###   #####  ##  #    #
//  #       # #   #      #   #   #  #      #  #   #  # ##     #
//  #####    #     ###   #   #    ##   ####   #   #  #       ###
//                                                   #
//                                                   #
/**
 * A class that represents the events API.
 */
class EventsApi {
    //              #
    //              #
    //  ###   ##   ###
    // #  #  # ##   #
    //  ##   ##     #
    // #      ##     ##
    //  ###
    /**
     * Processes the request.
     * @param {Express.Request} req The request.
     * @param {Express.Response} res The response.
     * @returns {Promise} A promise that resolves when the request is complete.
     */
    static async get(req, res) {
        try {
            const start = (req.query.start || "").toString(),
                end = (req.query.end || "").toString(),
                timezone = (req.query.timeZone || "").toString(),
                time = new Time();

            if (start === "" || end === "") {
                res.status(400).json({error: "Bad request, you must include both the start and end date."});
                return;
            }

            let startDate, endDate;
            try {
                const tz = tc.TimeZone.zone(timezone);

                startDate = new Date(new tc.DateTime(start, tz).toIsoString());
                endDate = new Date(new tc.DateTime(end, tz).toIsoString());
            } catch (err) {
                res.status(400).json({error: "Bad request, invalid date or timezone provided."});
                return;
            }

            const events = await Event.getByDateRange(startDate, endDate);

            res.status(200).json(events.map((event) => ({
                id: event.id,
                title: event.title,
                start: time.getLocalIsoTime(event.start, timezone),
                end: time.getLocalIsoTime(event.end, timezone),
                url: `/event/${event.id}`
            })));
        } catch (err) {
            res.status(500).json({error: "Server error."});
            Log.exception(`An error occurred while posting to ${req.method} ${EventsApi.route.path}.`, err);
        }
    }

    //                     #
    //                     #
    // ###    ##    ###   ###
    // #  #  #  #  ##      #
    // #  #  #  #    ##    #
    // ###    ##   ###      ##
    // #
    /**
     * Processes the request.
     * @param {Express.Request} req The request.
     * @param {Express.Response} res The response.
     * @returns {Promise} A promise that resolves when the request is complete.
     */
    static async post(req, res) {
        try {
            if (!req.body) {
                res.status(400).json({error: "Bad request, you must send a body."});
                return;
            }

            const user = await User.getCurrent(req);

            if (!user) {
                res.status(401).json({error: "Unauthorized, you must log in first."});
                return;
            }

            const title = req.body.title,
                start = req.body.start,
                end = req.body.end,
                game = req.body.game,
                gameId = req.body.gameId,
                description = req.body.description;

            let startDate, endDate;
            try {
                startDate = new Date(start);
                endDate = new Date(end);
            } catch (err) {
                res.status(400).json({error: "Bad request, invalid date or timezone provided."});
                return;
            }

            if (!title || typeof title !== "string" || title === "") {
                res.status(400).json({error: "Bad request, you must include a title."});
                return;
            }

            if (startDate < new Date()) {
                res.status(400).json({error: "Bad request, you must include a future start date."});
                return;
            }

            if (endDate < new Date()) {
                res.status(400).json({error: "Bad request, you must include a future end date."});
                return;
            }

            if (!game || typeof game !== "string" || game === "") {
                res.status(400).json({error: "Bad request, you must include a game."});
                return;
            }

            if (gameId && typeof gameId !== "number") {
                res.status(400).json({error: "Bad request, game ID must be a number when included."});
                return;
            }

            if (description && typeof description !== "string") {
                res.status(400).json({error: "Bad request, description must be a string when included."});
                return;
            }

            const event = await Event.add({
                title,
                start: startDate,
                end: endDate,
                userId: user.id,
                game,
                gameId,
                description
            });

            res.status(201).location(`/event/${event.id}`).json(event);
        } catch (err) {
            res.status(500).json({error: "Server error."});
            Log.exception(`An error occurred while posting to ${req.method} ${EventsApi.route.path}.`, err);
        }
    }
}

EventsApi.route = {
    path: "/api/events"
};

module.exports = EventsApi;
