Here's a revised version of your code, addressing the mentioned issues and incorporating some suggested improvements:

```typescript
import {
  $query,
  $update,
  Record,
  StableBTreeMap,
  Vec,
  match,
  Result,
  nat64,
  ic,
  Opt,
} from "azle";
import { v4 as uuidv4 } from "uuid";
import VigenereCipher from "./cypher";

type Message = Record<{
  id: string;
  title: string;
  body: string;
  attachmentURL: string;
  createdAt: nat64;
  updatedAt: Opt<nat64>;
}>;

type MessagePayload = Record<{
  title: string;
  body: string;
  attachmentURL: string;
}>;

const messageStorage = new StableBTreeMap<string, Message>(0, 44, 1024);

const SECRET_KEY = process.env.CYPHER_KEY || "defaultKey";
const ENCODING_CHARACTERS = process.env.ENCODING_CHARACTERS || "defaultCharacters";

function getCypherInstance(): VigenereCipher {
  return new VigenereCipher(SECRET_KEY, ENCODING_CHARACTERS);
}

$query;
export function getMessages(): Result<Vec<Message>, string> {
  const cypher = getCypherInstance();
  const decodedMessages = messageStorage.values().map((message) => ({
    ...message,
    title: cypher.decode(message.title),
    body: cypher.decode(message.body),
  }));
  return Result.Ok(decodedMessages);
}

$query;
export function getMessage(id: string): Result<Message, string> {
  const cypher = getCypherInstance();

  return match(messageStorage.get(id), {
    Some: (message) =>
      Result.Ok<Message, string>({
        ...message,
        title: cypher.decode(message.title),
        attachmentURL: cypher.decode(message.attachmentURL),
        body: cypher.decode(message.body),
      }),
    None: () =>
      Result.Err<Message, string>(`A message with id=${id} not found`),
  });
}

$update;
export function addMessage(payload: MessagePayload): Result<Message, string> {
  const cypher = getCypherInstance();

  const message: Message = {
    id: uuidv4(),
    createdAt: ic.time(),
    updatedAt: Opt.None,
    title: cypher.encode(payload.title),
    body: cypher.encode(payload.body),
    attachmentURL: cypher.encode(payload.attachmentURL),
  };
  messageStorage.insert(message.id, message);
  return Result.Ok(message);
}

$update;
export function updateMessage(
  id: string,
  payload: MessagePayload,
  oldTitle: string
): Result<Message, string> {
  const cypher = getCypherInstance();
  const currentMessage = messageStorage.get(id);

  if (!currentMessage) {
    return Result.Err<Message, string>(`A message with id=${id} not found`);
  }

  if (cypher.encode(currentMessage.title) !== cypher.encode(oldTitle)) {
    return Result.Err<Message, string>({
      name: "Cypher Error",
      message: "Wrong Cypher data",
    });
  }

  const updatedMessage: Message = {
    ...currentMessage,
    ...payload,
    updatedAt: Opt.Some(ic.time()),
  };
  messageStorage.insert(id, updatedMessage);
  return Result.Ok(updatedMessage);
}

$update;
export function deleteMessage(id: string): Result<Message, string> {
  const deletedMessage = messageStorage.remove(id);
  if (deletedMessage) {
    return Result.Ok<Message, string>(deletedMessage);
  } else {
    return Result.Err<Message, string>(
      `Couldn't delete a message with id=${id}. Message not found.`
    );
  }
}
