/****************************************************
 * VMRay Report Phishing - Google Workspace Add-on
 ****************************************************/

// --- CONFIGURATION ---
var CONFIG = {
  recipient: "###########@us.ir-mailbox.vmray.com", // VMRay IR mailbox
  confirmText: "Are you sure you want to report this email as phishing?",
  subjectPrefix: "Phishing Report - Google Add-on", // Prefix for the forwarded email subject
  successText: "✅ Email successfully reported to Security Team.",
  moveToLabel: "Phishing"
};

/**
 * Internal constants
 */
var CONSTANTS = {
  // Script Property KEY (NOT the label name)
  PROP_ROUTING_LABEL: "ROUTING_LABEL_NAME",

  // Fallback label if property not set
  DEFAULT_ROUTING_LABEL: CONFIG.moveToLabel,

  // Recipient domain restriction:
  // Allowed: @ir-mailbox.vmray.com OR @{subdomain}.ir-mailbox.vmray.com
  ALLOWED_RECIPIENT_BASE_DOMAIN: "ir-mailbox.vmray.com",

  // Label cache settings
  LABEL_CACHE_KEY: "LABEL_MAP_V1",
  LABEL_CACHE_TTL_SECONDS: 60 * 30, // 30 mins

  // Retry behavior
  RETRY_MAX_ATTEMPTS: 3,
  RETRY_BASE_SLEEP_MS: 250,

  // EML attachment defaults
  EML_FILENAME: "reported_email.eml",
  EML_MIME: "message/rfc822",

  ROUTE_FAILED_TEXT: "⚠️ Report sent, but moving the email failed.",
  INVALID_RECIPIENT_TEXT:
    "❌ Invalid recipient configuration. Recipient must be under domain: ir-mailbox.vmray.com"
};

/**
 * Gmail Add-on entry point
 */
function buildAddOn(e) {
  var messageId = getMessageIdFromEvent_(e);

  if (!messageId) {
    return CardService.newCardBuilder()
      .addSection(
        CardService.newCardSection()
          .addWidget(
            CardService.newTextParagraph()
              .setText("Please open an email to report it.")
          )
      )
      .build();
  }

  // ✅ Validate recipient config early (best UX)
  if (!isValidRecipient_(CONFIG.recipient)) {
    return CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle("Configuration Error"))
      .addSection(
        CardService.newCardSection()
          .addWidget(
            CardService.newTextParagraph().setText(
              CONSTANTS.INVALID_RECIPIENT_TEXT +
                "<br><br>Configured recipient:<br><b>" +
                String(CONFIG.recipient || "") +
                "</b>"
            )
          )
      )
      .build();
  }

  return showConfirmation({ parameters: { messageId: messageId } });
}

/**
 * Confirmation UI
 */
function showConfirmation(e) {
  var messageId = e.parameters.messageId;

  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle("Confirm Report"))
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText(CONFIG.confirmText))
        .addWidget(
          CardService.newButtonSet()
            .addButton(
              CardService.newTextButton()
                .setText("Confirm")
                .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
                .setOnClickAction(
                  CardService.newAction()
                    .setFunctionName("processReport")
                    .setParameters({ messageId: messageId })
                )
            )
        )
    );

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card.build()))
    .build();
}

/**
 * Main workflow:
 * 1. Fetch raw email
 * 2. Forward as EML
 * 3. Move thread to label (+ archive)
 */
function processReport(e) {
  try {
    // Defensive: validate recipient again
    if (!isValidRecipient_(CONFIG.recipient)) {
      return CardService.newActionResponseBuilder()
        .setNotification(
          CardService.newNotification().setText(CONSTANTS.INVALID_RECIPIENT_TEXT)
        )
        .build();
    }

    var messageId = e.parameters.messageId;
    if (!messageId) throw new Error("Missing messageId");

    var msg = gmailApiCall_(function () {
      return Gmail.Users.Messages.get("me", messageId, { format: "raw" });
    });

    if (!msg || !msg.raw) throw new Error("No raw content returned");

    var emlBlob = buildEmlBlob_(msg.raw);

    GmailApp.sendEmail(
      CONFIG.recipient,
      CONFIG.subjectPrefix,
      "A user has reported a phishing email",
      {
        attachments: [emlBlob],
        name: "Phishing Report Button"
      }
    );

    // Routing logic
    try {
      var routingLabelName = getRoutingLabelName_();
      if (routingLabelName) {
        moveThreadToLabel_(msg.threadId, routingLabelName);
      }
    } catch (routeErr) {
      console.error("Routing failed: " + safeErrorMessage_(routeErr));

      return CardService.newActionResponseBuilder()
        .setNotification(
          CardService.newNotification().setText(CONSTANTS.ROUTE_FAILED_TEXT)
        )
        .setNavigation(CardService.newNavigation().popToRoot())
        .build();
    }

    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(CONFIG.successText))
      .setNavigation(CardService.newNavigation().popToRoot())
      .build();

  } catch (err) {
    console.error(err);

    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification()
          .setText("❌ Reporting failed: " + safeErrorMessage_(err))
      )
      .build();
  }
}

/**
 * Move thread to label and archive
 */
function moveThreadToLabel_(threadId, labelName) {
  if (!threadId) throw new Error("Missing threadId");

  var normalized = String(labelName).trim();
  if (!normalized) throw new Error("Routing label name is empty");

  var labelId = ensureLabelId_(normalized);

  gmailApiCall_(function () {
    return Gmail.Users.Threads.modify(
      { addLabelIds: [labelId], removeLabelIds: ["INBOX"] },
      "me",
      threadId
    );
  });
}

/**
 * Ensure label exists
 */
function ensureLabelId_(labelName) {
  var labelMap = getLabelMapCached_();
  if (labelMap[labelName]) return labelMap[labelName];

  try {
    gmailApiCall_(function () {
      return Gmail.Users.Labels.create(
        {
          name: labelName,
          labelListVisibility: "labelShow",
          messageListVisibility: "show"
        },
        "me"
      );
    });
  } catch (e) {
    console.error("Label create failed, refreshing: " + safeErrorMessage_(e));
  }

  labelMap = refreshLabelMap_();
  if (!labelMap[labelName]) {
    throw new Error("Unable to create/find label: " + labelName);
  }

  return labelMap[labelName];
}

/**
 * Cache label list
 */
function getLabelMapCached_() {
  var cache = CacheService.getUserCache();
  var cached = cache.get(CONSTANTS.LABEL_CACHE_KEY);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {}
  }

  return refreshLabelMap_();
}

function refreshLabelMap_() {
  var labelsResp = gmailApiCall_(function () {
    return Gmail.Users.Labels.list("me");
  });

  var map = {};
  var labels = labelsResp.labels || [];

  for (var i = 0; i < labels.length; i++) {
    map[labels[i].name] = labels[i].id;
  }

  CacheService.getUserCache().put(
    CONSTANTS.LABEL_CACHE_KEY,
    JSON.stringify(map),
    CONSTANTS.LABEL_CACHE_TTL_SECONDS
  );

  return map;
}

/**
 * Get routing label from Script Properties
 */
function getRoutingLabelName_() {
  var props = PropertiesService.getScriptProperties();
  var value = props.getProperty(CONSTANTS.PROP_ROUTING_LABEL);

  if (!value || String(value).trim() === "") {
    return CONSTANTS.DEFAULT_ROUTING_LABEL;
  }

  return String(value).trim();
}

/**
 * Decode raw message → EML
 */
function buildEmlBlob_(rawOrBytes) {
  var decodedBytes;

  if (typeof rawOrBytes === "string") {
    var raw = rawOrBytes.replace(/-/g, "+").replace(/_/g, "/");
    while (raw.length % 4 !== 0) raw += "=";
    decodedBytes = Utilities.base64Decode(raw);
  } else {
    decodedBytes = rawOrBytes;
  }

  return Utilities.newBlob(decodedBytes, CONSTANTS.EML_MIME, CONSTANTS.EML_FILENAME);
}

/**
 * Recipient validation:
 * Allowed: @ir-mailbox.vmray.com OR @{subdomain}.ir-mailbox.vmray.com
 */
function isValidRecipient_(email) {
  if (!email) return false;

  var e = String(email).trim().toLowerCase();

  // Basic email format validation
  var re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!re.test(e)) return false;

  var parts = e.split("@");
  if (parts.length !== 2) return false;

  var domain = parts[1];
  var base = CONSTANTS.ALLOWED_RECIPIENT_BASE_DOMAIN.toLowerCase();

  // Allow exact base domain
  if (domain === base) return true;

  // Allow subdomains like us.ir-mailbox.vmray.com or eu.ir-mailbox.vmray.com
  if (domain.endsWith("." + base)) {
    var subdomainPart = domain.slice(0, domain.length - base.length - 1);
    if (!subdomainPart) return false;
    if (subdomainPart.includes("..")) return false;
    return true;
  }

  return false;
}

/**
 * Helpers
 */
function getMessageIdFromEvent_(e) {
  return (e && e.gmail && e.gmail.messageId) ? e.gmail.messageId : null;
}

function safeErrorMessage_(err) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  return err.message ? err.message : JSON.stringify(err);
}

/**
 * Gmail API retry wrapper
 */
function gmailApiCall_(fn) {
  var lastErr = null;

  for (var attempt = 1; attempt <= CONSTANTS.RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      return fn();
    } catch (err) {
      lastErr = err;

      var code = extractGmailErrorCode_(err);
      var retryable = (code === 429 || (code >= 500 && code <= 599));

      if (!retryable || attempt === CONSTANTS.RETRY_MAX_ATTEMPTS) {
        throw err;
      }

      Utilities.sleep(CONSTANTS.RETRY_BASE_SLEEP_MS * Math.pow(2, attempt - 1));
    }
  }

  throw lastErr;
}

function extractGmailErrorCode_(err) {
  try {
    var msg = safeErrorMessage_(err);
    var m = msg.match(/\b(4\d\d|5\d\d)\b/);
    return m ? parseInt(m[1], 10) : -1;
  } catch (e) {
    return -1;
  }
}