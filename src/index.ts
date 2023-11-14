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

$query;
export function getMessages(
  cypherKey: string,
  encodingCharacters: string
): Result<Vec<Message>, string> {
  const cypher = new VigenereCipher(cypherKey, encodingCharacters);
  return Result.Ok(
    messageStorage.values().map((message) => ({
      ...message,
      title: cypher.decode(message.title),
      body: cypher.decode(message.body),
    }))
  );
}

$query;
export function getMessage(
  id: string,
  cypherKey: string,
  encodingCharacters: string
): Result<Message, string> {
  const cypher = new VigenereCipher(cypherKey, encodingCharacters);

  return match(messageStorage.get(id), {
    Some: (message) =>
      Result.Ok<Message, string>({
        title: cypher.decode(message.title),
        attachmentURL: cypher.decode(message.attachmentURL),
        body: cypher.decode(message.body),
        createdAt: message.createdAt,
        id: message.id,
        updatedAt: message.updatedAt,
      }),
    None: () =>
      Result.Err<Message, string>(`a message with id=${id} not found`),
  });
}

$update;
export function addMessage(
  payload: MessagePayload,
  cypherKey: string,
  encodingCharacters: string
): Result<Message, string> {
  const cypher = new VigenereCipher(cypherKey, encodingCharacters);

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
  oldTitle: string,
  cypherKey: string,
  encodingCharacters: string
): Result<Message, string> | null | Error {
  const cypher = new VigenereCipher(cypherKey, encodingCharacters);
  const currentMessage = match(messageStorage.get(id), {
    Some: (message) => ({ ...message }),
    None: () => null,
  });

  if (!currentMessage) return null;
  if (cypher.encode(currentMessage.title) !== cypher.encode(oldTitle)) {
    return {
      name: "Cypher Error",
      message: "Wrong Cypher data",
    };
  }

  return match(messageStorage.get(id), {
    Some: (message) => {
      const updatedMessage: Message = {
        ...message,
        ...payload,
        updatedAt: Opt.Some(ic.time()),
      };
      messageStorage.insert(message.id, updatedMessage);
      return Result.Ok<Message, string>(updatedMessage);
    },
    None: () => null,
  });
}

$update;
export function deleteMessage(id: string): Result<Message, string> {
  return match(messageStorage.remove(id), {
    Some: (deletedMessage) => Result.Ok<Message, string>(deletedMessage),
    None: () =>
      Result.Err<Message, string>(
        `couldn't delete a message with id=${id}. message not found.`
      ),
  });
}

// a workaround to make uuid package work with Azle
globalThis.crypto = {
  // @ts-ignore
  getRandomValues: () => {
    let array = new Uint8Array(32);

    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }

    return array;
  },
};
