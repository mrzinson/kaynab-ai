const fs = require('fs');
const pdfParse = require('pdf-parse');

async function test() {
    console.log(typeof pdfParse);
    if (pdfParse.default) {
        console.log("has default");
    }
}
test();
