/* jslint node: true */
"use strict";

import "jest";
import { IAuthRequest, authParse, authEnforce } from "../../src/api/authMiddleware";
import express = require("express");
import { InvalidTokenError } from "../../src/api/InvalidTokenError";
import { UnauthorizedError } from "../../src/api/UnauthorizedError";

/**
 * Variables
 */

/* Attributes of the token:
 * user: admin
 * userid: 1
 * service: admin
 */
const jwt = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.\
eyJpc3MiOiJmdGFORTc0YUpSZm5WaU5sUHpKaEpQdjRGU05OcT\
EzQyIsImlhdCI6MTU2NjkyNDQ4NSwiZXhwIjoxNTY2OTI0OTA1\
LCJwcm9maWxlIjoiYWRtaW4iLCJncm91cHMiOlsxXSwidXNlcm\
lkIjoxLCJqdGkiOiIzNDkzN2E3OGJkNWIxNjdmMTg3ZTMyODZj\
NGE1N2YzOCIsInNlcnZpY2UiOiJhZG1pbiIsInVzZXJuYW1lIjoiYWRtaW4ifQ.\
U6IYw8Zpj2JOJ1g5mg-1wo2rzepfIwEqoCWs1BONngg";

// Mock functions
const mockConfig = {
  express: {
    next: jest.fn(),
    request: {
      header: jest.fn(),
    },
    response: jest.fn(() => ({
      get: jest.fn(),
      json: jest.fn(),
      status: jest.fn(),
      send: jest.fn(),
    })),
  },
};

/**
 * Mocks
 */
jest.doMock("express", () => ({
  express: mockConfig.express,
}));
