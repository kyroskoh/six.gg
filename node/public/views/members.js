/**
 * @typedef {import("../../src/models/user")} User
 * @typedef {import("../../types/browser/viewTypes").MembersViewParameters} ViewTypes.MembersViewParameters
 */

//  #   #                #                           #   #    #
//  #   #                #                           #   #
//  ## ##   ###   ## #   # ##    ###   # ##    ###   #   #   ##     ###   #   #
//  # # #  #   #  # # #  ##  #  #   #  ##  #  #       # #     #    #   #  #   #
//  #   #  #####  # # #  #   #  #####  #       ###    # #     #    #####  # # #
//  #   #  #      # # #  ##  #  #      #          #   # #     #    #      # # #
//  #   #   ###   #   #  # ##    ###   #      ####     #     ###    ###    # #
/**
 * A class that represents the members view.
 */
class MembersView {
    //              #
    //              #
    //  ###   ##   ###
    // #  #  # ##   #
    //  ##   ##     #
    // #      ##     ##
    //  ###
    /**
     * Gets the rendered page template.
     * @param {ViewTypes.MembersViewParameters} members The members.
     * @returns {string} An HTML string of the page.
     */
    get(members) {
        return /* html */`
            <div class="section">Six Gaming Members</div>
            <div id="members">
                <div class="header member">Member</div>
                <div class="header">Links</div>
                <div class="header">Location</div>
                ${members.sort((a, b) => (a.guildMember.displayName || a.guildMember.user.username || "").localeCompare(b.guildMember.displayName || b.guildMember.user.username || "")).map((user) => /* html */`
                    <div>
                        <img class="avatar" src="${user.guildMember.user.displayAvatarURL({size: 32, format: "png"})}" />
                    </div>
                    <div>
                        ${user.user ? /* html */`
                            <a href="/member/${user.user.id}/${encodeURIComponent(user.guildMember.displayName || user.guildMember.user.username || "")}">${MembersView.encoding.htmlEncode(user.guildMember.displayName || user.guildMember.user.username || "")}</a>
                        ` : MembersView.encoding.htmlEncode(user.guildMember.displayName || user.guildMember.user.username || "")}
                    </div>
                    <div>
                        ${user.user && user.user.connections && user.user.connections.filter((c) => ["steam", "twitch", "twitter", "youtube"].indexOf(c.type) !== -1).sort((a, b) => a.type.localeCompare(b.type)).map((connection) => /* html */`
                            <a href="${MembersView.connection.getUrl(connection)}" target="_blank"><img class="connection" src="/images/${connection.type}.png" alt="${connection.type}" /></a>
                        `).join("") || ""}
                    </div>
                    <div>${MembersView.encoding.htmlEncode(user.user && user.user.location || "")}</div>
                `).join("")}
            </div>
        `;
    }
}

/** @type {import("../js/common/connection")} */
// @ts-ignore
MembersView.connection = new (typeof Connection === "undefined" ? require("../js/common/connection") : Connection)(); // eslint-disable-line no-undef

/** @type {import("../js/common/encoding")} */
// @ts-ignore
MembersView.encoding = new (typeof Encoding === "undefined" ? require("../js/common/encoding") : Encoding)(); // eslint-disable-line no-undef

if (typeof module !== "undefined") {
    module.exports = MembersView; // eslint-disable-line no-undef
}
