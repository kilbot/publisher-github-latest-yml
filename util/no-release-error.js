"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = void 0;
class NoReleaseError extends Error {
    constructor(code) {
        super('No GitHub Release found');
        this.code = code;
    }
}
exports.default = NoReleaseError;
