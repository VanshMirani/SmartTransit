import assert from "node:assert/strict";
import test from "node:test";
import { isInstituteEmail, isValidOtp, normalizeIndianPhone, validateStudentRegistration, } from "../src/utils/registrationValidation.js";
const validRegistration = {
    fullName: "Nisha Verma",
    email: "nisha.verma@iite.indusuni.ac.in",
    phone: "9876543211",
    password: "Student@456",
    confirmPassword: "Student@456",
    otp: "123456",
    acceptedTerms: true,
};
test("accepts a complete Indus student registration", () => {
    assert.deepEqual(validateStudentRegistration(validRegistration), {});
});
test("requires an institute email and privacy acceptance", () => {
    const errors = validateStudentRegistration({
        ...validRegistration,
        email: "nisha.verma@gmail.com",
        acceptedTerms: false,
    });
    assert.match(errors.email ?? "", /indusuni\.ac\.in/);
    assert.match(errors.acceptedTerms ?? "", /privacy information/);
});
test("accepts Indus University root and institute subdomain emails only", () => {
    assert.equal(isInstituteEmail("nisha.verma@iite.indusuni.ac.in"), true);
    assert.equal(isInstituteEmail("nisha.verma@ict.indusuni.ac.in"), true);
    assert.equal(isInstituteEmail("nisha.verma@indusuni.ac.in"), true);
    assert.equal(isInstituteEmail("nisha.verma@example.com"), false);
});
test("ignores non-Indus extra signup domains from environment configuration", () => {
    const previous = process.env.SMARTTRANSIT_ALLOWED_SIGNUP_EMAIL_DOMAINS;
    process.env.SMARTTRANSIT_ALLOWED_SIGNUP_EMAIL_DOMAINS = "gmail.com";
    try {
        assert.equal(isInstituteEmail("smarttransit62@gmail.com"), false);
        assert.equal(isInstituteEmail("smarttransit62@yahoo.com"), false);
    }
    finally {
        if (previous === undefined)
            delete process.env.SMARTTRANSIT_ALLOWED_SIGNUP_EMAIL_DOMAINS;
        else
            process.env.SMARTTRANSIT_ALLOWED_SIGNUP_EMAIL_DOMAINS = previous;
    }
});
test("requires a six digit OTP when requested", () => {
    assert.equal(isValidOtp("123456"), true);
    assert.equal(isValidOtp("12345"), false);
    assert.equal(isValidOtp("12A456"), false);
    assert.match(validateStudentRegistration({
        ...validRegistration,
        otp: "12345",
    }, { requireOtp: true }).otp ?? "", /6-digit OTP/);
});
test("rejects weak or mismatched passwords", () => {
    const errors = validateStudentRegistration({
        ...validRegistration,
        password: "password",
        confirmPassword: "different",
    });
    assert.match(errors.password ?? "", /uppercase/);
    assert.match(errors.confirmPassword ?? "", /do not match/);
});
test("normalizes an Indian country code before phone validation", () => {
    assert.equal(normalizeIndianPhone("+91 98765 43211"), "9876543211");
    assert.deepEqual(validateStudentRegistration({
        ...validRegistration,
        phone: "+91 98765 43211",
    }), {});
});
