// init some stuff
require('./../../stores/actions.jsx');

// libs
var React = require("react");
var ReactDOM = require("react-dom");
var utils = require('./../../ui/utils.jsx');
var RenderDebugger = require('./../../stores/mixins.js').RenderDebugger;
var MegaRenderMixin = require('./../../stores/mixins.js').MegaRenderMixin;
var ButtonsUI = require('./../../ui/buttons.jsx');
var DropdownsUI = require('./../../ui/dropdowns.jsx');
var ContactsUI = require('./../ui/contacts.jsx');
var ConversationPanelUI = require("./../ui/conversationpanel.jsx");


var ConversationsListItem = React.createClass({
    mixins: [MegaRenderMixin, RenderDebugger],
    componentWillMount: function() {
        var self = this;
        self.chatRoomChangeListener = function() {
            self.forceUpdate();
        };
        self.props.chatRoom.addChangeListener(self.chatRoomChangeListener);
    },
    componentWillUnmount: function() {
        var self = this;
        self.props.chatRoom.removeChangeListener(self.chatRoomChangeListener);
    },
    render: function() {
        //console.error(
        //    'rendering: ',
        //    this.props.chatRoom.roomJid.split("@")[0],
        //    this.props.chatRoom.unreadCount,
        //    this.props.chatRoom.isCurrentlyActive
        //);

        var classString = "";


        var contactJid = this.props.chatRoom.getParticipantsExceptMe()[0];
        var contact = this.props.chatRoom.megaChat.getContactFromJid(contactJid);
        var id = 'conversation_' + htmlentities(contact.u);
        var roomShortJid = this.props.chatRoom.roomJid.split("@")[0];

        var caps = megaChat.karere.getCapabilities(contactJid);
        if (caps) {
            Object.keys(caps).forEach(function (k) {
                var v = caps[k];
                if (v) {
                    classString += " chat-capability-" + k;
                }
            });
        }

        // selected
        if (this.props.chatRoom.isCurrentlyActive) {
            classString += " active";
        }

        var presenceClass = this.props.chatRoom.megaChat.xmppPresenceToCssClass(
            contact.presence
        );

        var unreadCount = this.props.chatRoom.messagesBuff.getUnreadCount();
        var unreadDiv = "";
        var isUnread = false;
        if (unreadCount > 0) {
            unreadDiv = <div className="unread-messages">{unreadCount}</div>;
            isUnread = true;
        }

        var lastMessageDiv = "";
        var lastMessage = this.props.chatRoom.messagesBuff.getLatestTextMessage();
        if (lastMessage) {
            var lastMsgDivClasses = "conversation-message" + (isUnread ? " unread" : "");

            var renderableSummary = lastMessage.textContents;

            if (lastMessage.isManagement && lastMessage.isManagement()) {
                renderableSummary = lastMessage.getManagementMessageSummaryText();
            }

            lastMessageDiv =
                <div>
                    <div className={lastMsgDivClasses}>
                        {renderableSummary}
                    </div>
                    <div className="date-time">{unixtimeToTimeString(lastMessage.delay)}</div>
                </div>;
        }
        else {
            var lastMsgDivClasses = "conversation-message";
            lastMessageDiv =
                <div>
                    <div className={lastMsgDivClasses}>
                        {__("No conversation history")}
                    </div>
                </div>;
        }

        var avatarMeta = generateAvatarMeta(contact.u);

        return (
            <li className={classString} id={id} data-room-jid={roomShortJid} data-jid={contactJid} onClick={this.props.onConversationClicked}>
                <div className="user-card-name conversation-name">
                    {avatarMeta.fullName}
                    <span className={"user-card-presence " + presenceClass}></span>
                </div>
                {unreadDiv}
                {lastMessageDiv}
            </li>
        );
    }
});

var ConversationsList = React.createClass({
    mixins: [MegaRenderMixin, RenderDebugger],
    conversationClicked: function(room, e) {
        var contact = room.megaChat.getContactFromJid(
            room.getParticipantsExceptMe()[0]
        );

        window.location = "#fm/chat/" + contact.u;
        e.stopPropagation();
    },
    currentCallClicked: function(e) {
        var activeCallSession = this.props.megaChat.activeCallSession;
        if (activeCallSession) {
            this.conversationClicked(activeCallSession.room, e);
        }
    },
    contactClicked: function(contact, e) {
        window.location = "#fm/chat/" + contact.u;
        e.stopPropagation();
    },
    endCurrentCall: function(e) {
        var activeCallSession = this.props.megaChat.activeCallSession;
        if (activeCallSession) {
            activeCallSession.endCall('hangup');
            this.conversationClicked(activeCallSession.room, e);
        }
    },
    handleWindowResize: function() {
        var $container = $(document.querySelector('.content-panel.conversations').parentNode.parentNode.parentNode);
        var $jsp = $container.data('jsp');

        $container.height(
            $(window).outerHeight() -  $('#topmenu').outerHeight()
        );

        if ($jsp) {
            $jsp.reinitialise();
        }
    },
    componentDidMount: function() {
        window.addEventListener('resize', this.handleWindowResize);
        this.handleWindowResize();
    },
    componentWillUnmount: function() {
        window.removeEventListener('resize', this.handleWindowResize);
    },
    componentDidUpdate: function() {
        this.handleWindowResize();
    },
    render: function() {
        var self = this;

        var currentCallingContactStatusProps = {
            'className': "nw-conversations-item current-calling",
            'data-jid': ''
        };
        var callName;
        var currentCallingHeaderClasses = "nw-conversations-header call-started";

        var megaChat = this.props.megaChat;

        var activeCallSession = megaChat.activeCallSession;
        if (activeCallSession && activeCallSession.room && megaChat.activeCallSession.isActive()) {
            var room = activeCallSession.room;
            var user = room.getParticipantsExceptMe()[0];
            user = megaChat.getContactFromJid(user);

            if (user) {
                currentCallingContactStatusProps.className += " " + user.u + " " + megaChat.xmppPresenceToCssClass(user.presence);
                currentCallingContactStatusProps['data-jid'] = room.roomJid;
                callName = room.getRoomTitle();

                if (room.roomJid == megaChat.currentlyOpenedChat) {
                    currentCallingContactStatusProps.className += " selected";
                }
            }
            else {
                currentCallingContactStatusProps.className += ' hidden';
            }
        }
        else {
            currentCallingContactStatusProps.className += ' hidden';
        }

        if (!callName) {
            currentCallingHeaderClasses += " hidden";
        }
        var currConvsList = [];
        this.props.chats.map((chatRoom, k) => {
            if (chatRoom._leaving || chatRoom.stateIsLeftOrLeaving()) {
                return;
            }
            if (
                megaChat.activeCallSession &&
                chatRoom == megaChat.activeCallSession.room &&
                megaChat.activeCallSession.isActive()
            ) {
                return;
            }

            var contact = chatRoom.getParticipantsExceptMe()[0];
            contact = chatRoom.megaChat.getContactFromJid(contact);

            if (contact && contact.c === 0) {
                // skip & leave, a non-contact conversation, e.g. contact removed.
                Soon(function() {
                    chatRoom.destroy();
                });
                return;
            }

            currConvsList.push(
                <ConversationsListItem key={k} chatRoom={chatRoom} megaChat={megaChat} onConversationClicked={(e) => {
                    self.conversationClicked(chatRoom, e);
                }} />
            );
        });


        return (
            <div className="conversationsList">
                <ul className="conversations-pane">
                    {currConvsList}
                </ul>
            </div>
        );
    }
});


var ConversationsApp = React.createClass({
    mixins: [MegaRenderMixin, RenderDebugger],
    startChatClicked: function(contact, e) {
        e.preventDefault();
        window.location = "#fm/chat/" + contact.u;
        var room = this.props.megaChat.createAndShowPrivateRoomFor(contact.u);
    },
    componentDidMount: function() {
        window.addEventListener('resize', this.handleWindowResize);
        this.handleWindowResize();

    },
    componentWillUnmount: function() {
        window.removeEventListener('resize', this.handleWindowResize);
    },
    componentDidUpdate: function() {
        this.handleWindowResize();
    },
    handleWindowResize: function() {
        var $container = $(ReactDOM.findDOMNode(this));

        $container.height(
            $(window).outerHeight() -  $('#topmenu').outerHeight()
        );
    },
    render: function() {
        var self = this;

        //console.error("ConversationsApp render");

        var presence = self.props.megaChat.karere.getMyPresence();

        var startChatIsDisabled = !presence || presence === "offline";


        return (
            <div className="conversationsApp" key="conversationsApp">
                <div className="fm-left-panel">
                    <div className="left-pane-drag-handle"></div>

                    <div className="fm-left-menu conversations">
                        <div className="nw-fm-tree-header conversations">
                            <span>{__("Chat")}</span>

                            <ButtonsUI.Button
                                group="conversationsListing"
                                icon="white-medium-plus"
                                disabled={startChatIsDisabled}
                                contacts={this.props.contacts}
                                >
                                <DropdownsUI.DropdownContactsSelector
                                    contacts={this.props.contacts}
                                    megaChat={this.props.megaChat}
                                    onClick={this.startChatClicked}
                                    />
                            </ButtonsUI.Button>
                        </div>
                    </div>


                    <div className="fm-tree-panel">
                        <div className="content-panel conversations">
                            <ConversationsList chats={this.props.megaChat.chats} megaChat={this.props.megaChat} contacts={this.props.contacts} />
                        </div>
                    </div>
                </div>
                <div className="fm-right-files-block">
                    <div className="fm-right-header fm hidden">
                    </div>


                    <div className="fm-empty-messages hidden">
                    <div className="fm-empty-pad">
                        <div className="fm-empty-messages-bg"></div>
                        <div className="fm-empty-cloud-txt">No Messages</div>
                        <div className="fm-not-logged-text">
                            <div className="fm-not-logged-description">
                                Login or create an account to <span className="red">get 50GB FREE</span> and get messages from your friends and coworkers.
                            </div>
                            <div className="fm-not-logged-button login">
                                Login
                            </div>
                            <div className="fm-not-logged-button create-account">
                                Create account
                            </div>
                        </div>
                    </div>
                    </div>


                    <ConversationPanelUI.ConversationPanels
                        {...this.props}
                        conversations={this.props.megaChat.chats}
                        />
                        
                </div>
            </div>
        );
    }
});


module.exports = {
    ConversationsList,
    ConversationsApp
};
