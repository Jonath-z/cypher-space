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

/**
 * Validate if the given payload is a valid MessagePayload
 */
function isValidMessagePayload(payload: MessagePayload): boolean {
  return !!(
    payload &&
    typeof payload.title === "string" &&
    typeof payload.body === "string" &&
    typeof payload.attachmentURL === "string"
  );
}

// Query function to get all messages
$query;
export function getMessages(
  cypherKey: string,
  encodingCharacters: string
): Result<Vec<Message>, string> {
  try {
    const cipher = new VigenereCipher(cypherKey, encodingCharacters);

    // Decrypt titles and bodies of all messages
    const decodedMessages = messageStorage.values().map((message) => ({
      ...message,
      title: decryptText(message.title, cipher),
      body: decryptText(message.body, cipher),
    }));

    return Result.Ok(decodedMessages);
  } catch (error) {
    return Result.Err<Vec<Message>, string>(`Error getting messages: ${error}`);
  }
}

// Query function to get a specific message by ID
$query;
export function getMessage(
  id: string,
  cypherKey: string,
  encodingCharacters: string
): Result<Message, string> {
  try {
    // Validate if the provided ID is a valid UUID
    if (!id) {
      throw new Error("Invalid ID format. Please provide a valid UUID.");
    }

    const cipher = new VigenereCipher(cypherKey, encodingCharacters);

    return match(messageStorage.get(id), {
      Some: (message) => {
        // Decrypt title, body, and attachmentURL of the message
        return Result.Ok<Message, string>({
          ...message,
          title: decryptText(message.title, cipher),
          attachmentURL: decryptText(message.attachmentURL, cipher),
          body: decryptText(message.body, cipher),
        });
      },
      None: () => Result.Err<Message, string>(ErrorName.NotFound),
    });
  } catch (error) {
    return Result.Err<Message, string>(`Error getting message: ${error}`);
  }
}

// Update function to add a new message
$update;
export function addMessage(
  payload: MessagePayload,
  cypherKey: string,
  encodingCharacters: string
): Result<Message, string> {
  try {
    const cipher = new VigenereCipher(cypherKey, encodingCharacters);

    if (!isValidMessagePayload(payload)) {
      return Result.Err(`${ErrorName.InvalidPayload}: Invalid payload format for creating Message.`);
    }

    const message: Message = {
      id: uuidv4(),
      createdAt: ic.time(),
      updatedAt: Opt.None,
      title: encryptText(payload.title, cipher),
      body: encryptText(payload.body, cipher),
      attachmentURL: encryptText(payload.attachmentURL, cipher),
    };

    // Insert the new message into storage
    try {
      messageStorage.insert(message.id, message);
    } catch (error) {
      return Result.Err<Message, string>(`Error inserting message: ${error}`);
    }
    return Result.Ok(message);
  } catch (error) {
    return Result.Err<Message, string>(`Error updating message: ${error}`);
  }
}

// Update function to update an existing message
$update;
export function updateMessage(
  id: string,
  payload: MessagePayload,
  oldTitle: string,
  cypherKey: string,
  encodingCharacters: string
): Result<Message, string> {
  try {
    // Validate if the provided ID is a valid UUID
    if (!id) {
      throw new Error("Invalid ID format. Please provide a valid UUID.");
    }

    const cipher = new VigenereCipher(cypherKey, encodingCharacters);

    // Retrieve the current message from storage
    const currentMessage = match(messageStorage.get(id), {
      Some: (message) => ({ ...message }),
      None: () => null,
    });

    // Check if the message exists
    if (!currentMessage) {
      return Result.Err<Message, string>(ErrorName.NotFound);
    }

    // Check if the provided oldTitle matches the encrypted title in storage
    if (encryptText(currentMessage.title, cipher) !== encryptText(oldTitle, cipher)) {
      return Result.Err<Message, string>(
        `${ErrorName.InvalidPayload}: Wrong Cypher data`
      );
    }

    // Update the existing message with the new payload
    return match(messageStorage.get(id), {
      Some: (message) => {
        const updatedMessage: Message = {
          ...message,
          ...payload,
          updatedAt: Opt.Some(ic.time()),
        };

        // Insert the updated message into storage
        messageStorage.insert(message.id, updatedMessage);
        return Result.Ok<Message, string>(updatedMessage);
      },
      None: () => Result.Err<Message, string>(ErrorName.NotFound),
    });
  } catch (error) {
    return Result.Err<Message, string>(`Error updating message: ${error}`);
  }
}

// Update function to delete an existing message
$update;
export function deleteMessage(id: string): Result<Message, string> {
  try {
    // Validate if the provided ID is a valid UUID
    if (!id) {
      throw new Error("Invalid ID format. Please provide a valid UUID.");
    }

    return match(messageStorage.remove(id), {
      Some: (deletedMessage) => Result.Ok<Message, string>(deletedMessage),
      None: () => Result.Err<Message, string>(
        `Couldn't delete a message with id=${id}. Message not found.`
      ),
    });
  } catch (error) {
    return Result.Err<Message, string>(`Error deleting message: ${error}`);
  }
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
