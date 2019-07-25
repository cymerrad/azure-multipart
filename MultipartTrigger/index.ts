import { AzureFunction, Context, HttpRequest } from "@azure/functions";

const httpTrigger: AzureFunction = async function(
  context: Context,
  req: HttpRequest
): Promise<void> {
  context.log("HTTP trigger function processed a request.");

  if (req.method == "POST") {
    try {
      let res = parseAzureRequest(req);
      context.res = {
        status: 200,
        body: res
      };
    } catch (err) {
      context.res = {
        status: 500,
        body: `Could not process the body: ${err}`
      };
    }
  } else {
    context.res = {
      status: 400,
      body: "POST only"
    };
  }

  context.done();
};

// duplication but much easier and cleaner than https://stackoverflow.com/questions/44154009/get-array-of-string-literal-type-values
type MultipartMimeType = "multipart/form-data" | "multipart/mixed";
const mimeTypes: MultipartMimeType[] = [
  "multipart/form-data",
  "multipart/mixed"
];
const mimeTypesForRe = mimeTypes.map(str => `(${str.replace("/", "//")})`);

function parseAzureRequest(req: HttpRequest): string {
  // fun fact: Azure lower-cases the headers (y)
  let contentTypeHeader = req.headers["content-type"];
  if (!contentTypeHeader) {
    throw `Content-Type header is missing; got ${contentTypeHeader}; req.headers ${JSON.stringify(
      req.headers
    )}`;
  }

  // extract boundary from this
  let [contentType, boundary] = parseContentTypeHeader(contentTypeHeader);

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
function parseContentTypeHeader(header: string): [MultipartMimeType, string] {
  let split = header.split(";");
  // we are looking for a boundary and a "multipart/form-data"
  // in general it could be "multipart/mixed" with separate content type for each part

  let mimeType: MultipartMimeType;
  let boundary: string;

  split.forEach(headerPart => {
    let match = mimeRe.exec(headerPart);
    if (match !== null) {
      // IF IT MATCHED THEN IT IS ONE OF THE EXPECTED TYPE VALUES
      [mimeType] = match as any[];
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

function parseRawBody(body?: any): object {
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

function top(text: string, lineCount: number): string {
  let lines = text.split("\n", lineCount);
  return lines.join("\n");
}

export default httpTrigger;
