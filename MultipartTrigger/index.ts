import { Context, HttpRequest } from "@azure/functions";

type WTF8Body = string;
// type ByteBufferBody = {
//   type: "Buffer"; // or maybe something else
//   data: Uint8Array;
// };
type ByteBufferBody = Uint8Array;
interface HttpRequestDetailed extends HttpRequest {
  body?: ByteBufferBody;
  rawBody?: WTF8Body;
}

async function httpTrigger(
  context: Context,
  req: HttpRequestDetailed
): Promise<void> {
  context.log("HTTP trigger function processed a request.");
  let debugObj = { stoppedAt: "httpTrigger" };

  if (req.method == "POST") {
    try {
      let res = parseAzureRequest(req, debugObj);
      context.res = {
        status: 200,
        body: JSON.stringify(res)
      };
    } catch (err) {
      debugObj["catchErr"] = err;
      context.res = {
        status: 500,
        body: JSON.stringify(debugObj)
      };
    }
  } else {
    context.res = {
      status: 400,
      body: "POST only"
    };
  }

  context.done();
}

// duplication but much easier and cleaner than https://stackoverflow.com/questions/44154009/get-array-of-string-literal-type-values
type MultipartMimeType = "multipart/form-data" | "multipart/mixed";
const mimeTypes: MultipartMimeType[] = [
  "multipart/form-data",
  "multipart/mixed"
];

function copyOntoField(target: any, field: string, source: any): void {
  target[field] = target[field] || {};
  Object.assign(target[field], source);
}

interface ParsedAzureRequest {
  rawBody: ParsedBody;
  body: ParsedBody;
  contentType: MultipartMimeType;
  boundary: string;
}

function parseAzureRequest(
  req: HttpRequestDetailed,
  debugObj: any
): ParsedAzureRequest {
  debugObj["stoppedAt"] = "parseAzureRequest";

  ["headers"].forEach(element => {
    copyOntoField(debugObj, element, req[element]);
  });

  // fun fact: Azure lower-cases the headers (y)
  let contentTypeHeader = req.headers["content-type"];
  if (!contentTypeHeader) {
    throw `Content-Type header is missing`;
  }

  // extract boundary from this
  let [contentType, boundary] = parseContentTypeHeader(
    contentTypeHeader,
    debugObj
  );

  debugObj["contentType"] = contentType;
  debugObj["boundary"] = boundary;

  // according to a comment in typings, this is WTF-8'ised body of the message
  // let rawBody: string = req.rawBody!;
  // let semiRawBody: string = req.body;

  let rawBody, body;
  if (req.rawBody) {
    rawBody = parseRawBody(req.rawBody!, debugObj);
  } else {
    rawBody = { error: "missing" };
  }

  if (req.body) {
    body = parseRawBody(req.body!, debugObj);
  } else {
    body = { error: "missing" };
  }

  let data = {
    rawBody: rawBody,
    body: body,
    contentType: contentType,
    boundary: boundary
  };

  return data;
}

const boundaryRe = /boundary=([\S ]*\S)/;
const mimeTypesForRe = mimeTypes.map(str => `(${str})`);
const mimeRe = new RegExp(mimeTypesForRe.join("|"));
/**
 * according to HTTP specification (https://www.w3.org/Protocols/rfc1341/7_2_Multipart.html)
 * boundary consists of up to 70 characters out of following
 * DIGIT / ALPHA / "'" / "(" / ")" / "+"  / "_" / "," / "-" / "." / "/" / ":" / "=" / "?" / " "
 * and the last character cannot be a space character
 * e.g. boundary=0a'()+_,-./:=? end
 * @param val
 */
function parseContentTypeHeader(
  header: string,
  debugObj: any
): [MultipartMimeType, string] {
  debugObj["stoppedAt"] = "parseContentTypeHeader";

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
    debugObj["headerPart"] = split;
    debugObj["regexes"] = [mimeRe.toString(), boundaryRe.toString()];
    throw "Incorrect mime type";
  }

  if (boundary === undefined) {
    debugObj["headerPart"] = split;
    debugObj["regexes"] = [mimeRe.toString(), boundaryRe.toString()];
    throw "Incorrect boundary (HOW?!)";
  }

  return [mimeType, boundary];
}

interface ParsedBody {
  type: string;
  buffer: Uint8Array;
  rest: any;
}

function parseRawBody(
  body: WTF8Body | ByteBufferBody,
  debugObj?: any
): ParsedBody {
  // we first have to discover what it is, really
  // so in the first iteration I'll be just identifing the object
  // and returning some data regarding it

  let type = typeof body;
  debugObj["stoppedAt"] = `parseRawBody@${type}`;

  switch (type) {
    case "string":
      let coercedW = body as WTF8Body;
      let top10 = type !== "string" ? "" : top(coercedW, 10);
      let buf = Buffer.from(coercedW, "utf8");

      return {
        type: type,
        buffer: buf,
        rest: top10
      };
    // break;

    case "object":
      let buff;
      let coercedB = body as ByteBufferBody;
      try {
        buff = Buffer.from(coercedB);
      } catch (err) {
        throw "Creating buffer failed; " + err;
      }

      return {
        type: type,
        buffer: buff,
        rest: ""
      };
    // break;

    default:
      return {
        type,
        rest: body,
        buffer: Buffer.from([])
      };
    // break;
  }
}

function top(text: string, lineCount: number): string {
  let lines = text.split("\n", lineCount);
  return lines.join("\n");
}

export default httpTrigger;
