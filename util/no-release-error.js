class NoReleaseError extends Error {
    constructor(code) {
        super('No GitHub Release found');
        this.code = code;
    }
}
export { NoReleaseError as default };
