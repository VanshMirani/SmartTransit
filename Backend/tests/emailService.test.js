import assert from "node:assert/strict";
import test from "node:test";
import { getMissingMailSettings } from "../emailService.js";

test("email settings support Brevo provider for Render", () => {
    const missing = getMissingMailSettings({
        SMARTTRANSIT_EMAIL_PROVIDER: "brevo",
        SMARTTRANSIT_BREVO_API_KEY: "xkeysib-test",
        SMARTTRANSIT_MAIL_FROM: "SmartTransit <sender@example.com>",
        SMARTTRANSIT_OTP_SECRET: "long-secret",
    });
    assert.deepEqual(missing, []);
});

test("email settings require Brevo API key when Brevo is selected", () => {
    const missing = getMissingMailSettings({
        SMARTTRANSIT_EMAIL_PROVIDER: "brevo",
        SMARTTRANSIT_MAIL_FROM: "SmartTransit <sender@example.com>",
        SMARTTRANSIT_OTP_SECRET: "long-secret",
    });
    assert.deepEqual(missing, ["SMARTTRANSIT_BREVO_API_KEY"]);
});

test("email settings keep SMTP provider available for local Gmail", () => {
    const missing = getMissingMailSettings({
        SMARTTRANSIT_EMAIL_PROVIDER: "smtp",
        SMARTTRANSIT_SMTP_HOST: "smtp.gmail.com",
        SMARTTRANSIT_SMTP_USER: "sender@gmail.com",
        SMARTTRANSIT_SMTP_PASS: "app-password",
        SMARTTRANSIT_MAIL_FROM: "SmartTransit <sender@gmail.com>",
        SMARTTRANSIT_OTP_SECRET: "long-secret",
    });
    assert.deepEqual(missing, []);
});
