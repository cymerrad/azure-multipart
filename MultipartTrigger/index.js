"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const httpTrigger = function (context, req) {
    return __awaiter(this, void 0, void 0, function* () {
        context.log("HTTP trigger function processed a request.");
        const name = req.query.name || (req.body && req.body.name);
        if (req.method == "POST") {
            try {
                let res = parseAzureRequest(req);
                context.res = {
                    status: 200,
                    body: res
                };
            }
            catch (err) {
                context.res = {
                    status: 500,
                    body: `Could not process the body: ${err}`
                };
            }
        }
        else {
            context.res = {
                status: 400,
                body: "POST only"
            };
        }
        req.rawBody;
        if (name) {
            context.res = {
                // status: 200, /* Defaults to 200 */
                body: "Hello " + (req.query.name || req.body.name)
            };
        }
        else {
            context.res = {
                status: 400,
                body: "Please pass a name on the query string or in the request body"
            };
        }
    });
};
const mimeTypes = [
    "multipart/form-data",
    "multipart/mixed"
];
const mimeTypesForRe = mimeTypes.map(str => `(${str.replace("/", "//")})`);
function parseAzureRequest(req) {
    // extract boundary from this
    let [contentType, boundary] = parseContentTypeHeader(req.headers["Content-Type"]);
    // according to a comment in typings, this is WTF-8'ised body of the message
    // let rawBody: string = req.rawBody!;
    // let semiRawBody: string = req.body;
    let data = {
        rawBody: parseRawBody(req.rawBody),
        body: parseRawBody(req.body),
        contentType: contentType,
        boundary: boundary
    };
    return JSON.stringify(data);
}
const boundaryRe = /boundary=([\S ]*\S)/;
const mimeRe = new RegExp(mimeTypesForRe.join("|"));
/**
 * according to HTTP specification (https://www.w3.org/Protocols/rfc1341/7_2_Multipart.html)
 * boundary consists of up to 70 characters out of following
 * DIGIT / ALPHA / "'" / "(" / ")" / "+"  / "_" / "," / "-" / "." / "/" / ":" / "=" / "?" / " "
 * and the last character cannot be a space character
 * e.g. boundary=0a'()+_,-./:=? end
 * @param val
 */
function parseContentTypeHeader(header) {
    let split = header.split(";");
    // we are looking for a boundary and a "multipart/form-data"
    // in general it could be "multipart/mixed" with separate content type for each part
    let mimeType;
    let boundary;
    split.forEach(headerPart => {
        let match = mimeRe.exec(headerPart);
        if (match !== null) {
            // IF IT MATCHED THEN IT IS ONE OF THE EXPECTED TYPE VALUES
            [mimeType] = match;
        }
    });
    split.forEach(headerPart => {
        let match = boundaryRe.exec(headerPart);
        if (match !== null) {
            [, boundary] = match;
        }
    });
    if (mimeType === undefined) {
        throw "Incorrect mime type";
    }
    if (boundary === undefined) {
        throw "Incorrect boundary (HOW?!)";
    }
    return [mimeType, boundary];
}
function parseRawBody(body) {
    // we first have to discover what it is, really
    // so in the first iteration I'll be just identifing the object
    // and returning some data regarding it
    let type = typeof body;
    let top10 = type !== "string" ? "" : top(body, 10);
    let data = {
        type,
        top10
    };
    return data;
}
function top(text, lineCount) {
    let lines = text.split("\n", lineCount);
    return lines.join("\n");
}
exports.default = httpTrigger;
