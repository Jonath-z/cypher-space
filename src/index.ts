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

enum ErrorName {
  NotFound = "NotFound",
  InvalidPayload = "InvalidPayload",
}

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

// Utility functions for Vigenere cipher
function encryptText(text: string, cipher: VigenereCipher): string {
  return cipher.encode(text);
}

function decryptText(text: string, cipher: VigenereCipher): string {
  return cipher.decode(text);
}

$query;
export function getMessages(
  cypherKey: string,
  encodingCharacters: string
): Result<Vec<Message>, string> {
  const cipher = new VigenereCipher(cypherKey, encodingCharacters);
  const decodedMessages = messageStorage.values().map((message) => ({
    ...message,
    title: decryptText(message.title, cipher),
    body: decryptText(message.body, cipher),
  }));
  return Result.Ok(decodedMessages);
}

$query;
export function getMessage(
  id: string,
  cypherKey: string,
  encodingCharacters: string
): Result<Message, string> {
  const cipher = new VigenereCipher(cypherKey, encodingCharacters);

  return match(messageStorage.get(id), {
    Some: (message) => {
      return Result.Ok<Message, string>({
        ...message,
        title: decryptText(message.title, cipher),
        attachmentURL: decryptText(message.attachmentURL, cipher),
        body: decryptText(message.body, cipher),
      });
    },
    None: () => Result.Err<Message, string>(ErrorName.NotFound),
  });
}

$update;
export function addMessage(
  payload: MessagePayload,
  cypherKey: string,
  encodingCharacters: string
): Result<Message, string> {
  const cipher = new VigenereCipher(cypherKey, encodingCharacters);

  const message: Message = {
    id: uuidv4(),
    createdAt: ic.time(),
    updatedAt: Opt.None,
    title: encryptText(payload.title, cipher),
    body: encryptText(payload.body, cipher),
    attachmentURL: encryptText(payload.attachmentURL, cipher),
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
  const cipher = new VigenereCipher(cypherKey, encodingCharacters);
  const currentMessage = match(messageStorage.get(id), {
    Some: (message) => ({ ...message }),
    None: () => null,
  });

  if (!currentMessage) return null;
  if (encryptText(currentMessage.title, cipher) !== encryptText(oldTitle, cipher)) {
    return {
      name: ErrorName.InvalidPayload,
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
    None: () => Result.Err<Message, string>(
      `Couldn't delete a message with id=${id}. Message not found.`
    ),
  });
}

// Workaround for making uuid package work with Azle
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
