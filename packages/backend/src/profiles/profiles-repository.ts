import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { ddb, tables } from "../lib/ddb.js";
import type { ProfileRow } from "../types/database.js";

export const profilesRepo = {
  async getByUserId(userId: string): Promise<ProfileRow | null> {
    const res = await ddb.get().send(new GetCommand({
      TableName: tables.profiles(),
      Key: { user_id: userId },
    }));
    return (res.Item as ProfileRow | undefined) ?? null;
  },

  async create(userId: string, input: { name: string }): Promise<ProfileRow> {
    const now = new Date().toISOString();
    const row: ProfileRow = {
      user_id: userId,
      name: input.name,
      language: "en-US",
      timezone: "Etc/UTC",
      about: "",
      debug: null,
      created_at: now,
      updated_at: now,
    };
    await ddb.get().send(new PutCommand({
      TableName: tables.profiles(),
      Item: row,
    }));
    return row;
  },

  async update(
    userId: string,
    patch: { name: string; language: string; timezone: string; about: string },
  ): Promise<ProfileRow> {
    const res = await ddb.get().send(new UpdateCommand({
      TableName: tables.profiles(),
      Key: { user_id: userId },
      UpdateExpression: "SET #n = :n, #l = :l, #tz = :tz, #a = :a, #u = :u",
      ExpressionAttributeNames: {
        "#n": "name",
        "#l": "language",
        "#tz": "timezone",
        "#a": "about",
        "#u": "updated_at",
      },
      ExpressionAttributeValues: {
        ":n": patch.name,
        ":l": patch.language,
        ":tz": patch.timezone,
        ":a": patch.about,
        ":u": new Date().toISOString(),
      },
      ReturnValues: "ALL_NEW",
    }));
    return res.Attributes as ProfileRow;
  },
};
