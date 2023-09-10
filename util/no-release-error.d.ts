declare class NoReleaseError extends Error {
    code: number;
    constructor(code: number);
}
export { NoReleaseError as default };
