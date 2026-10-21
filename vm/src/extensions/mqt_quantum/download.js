/**
 * Offer `text` to the user as a file download. Does nothing outside a browser (e.g. in Node tests).
 * @param {string} fileName Suggested name of the downloaded file.
 * @param {string} text File contents.
 */
const downloadTextFile = function (fileName, text) {
    if (typeof document === 'undefined') return;
    const url = URL.createObjectURL(new Blob([text], {type: 'text/plain'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 0);
};

module.exports = {downloadTextFile};
