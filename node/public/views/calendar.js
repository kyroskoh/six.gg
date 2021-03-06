/**
 * @typedef {import("../../types/browser/viewTypes").CalendarViewParameters} ViewTypes.CalendarViewParameters
 */

//   ###           ##                      #                #   #    #
//  #   #           #                      #                #   #
//  #       ###     #     ###   # ##    ## #   ###   # ##   #   #   ##     ###   #   #
//  #          #    #    #   #  ##  #  #  ##      #  ##  #   # #     #    #   #  #   #
//  #       ####    #    #####  #   #  #   #   ####  #       # #     #    #####  # # #
//  #   #  #   #    #    #      #   #  #  ##  #   #  #       # #     #    #      # # #
//   ###    ####   ###    ###   #   #   ## #   ####  #        #     ###    ###    # #
/**
 * A class that represents the calendar view.
 */
class CalendarView {
    //              #
    //              #
    //  ###   ##   ###
    // #  #  # ##   #
    //  ##   ##     #
    // #      ##     ##
    //  ###
    /**
     * Gets the rendered page template.
     * @param {ViewTypes.CalendarViewParameters} data The page data.
     * @returns {string} An HTML string of the page.
     */
    get(data) {
        const {timezone, defaultTimezone} = data;
        return /* html */`
            <div class="section">Six Gaming Calendar of Events</div>
            ${defaultTimezone ? /* html */`
                <div class="subsection">All times are in US Pacific time.</div>
            ` : ""}
            <div id="calendar"></div>
            <script>
                window.timezone = "${timezone.replace(/"/gm, "\\\"")}";
                window.defaultTimezone = ${defaultTimezone};
            </script>
        `;
    }
}

if (typeof module !== "undefined") {
    module.exports = CalendarView; // eslint-disable-line no-undef
}
