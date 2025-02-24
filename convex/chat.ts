import { internalAction, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

// new convex mutation function called sendMessage
// the whole function runs as a transaction that will roll back if an exception is thrown.
export const sendMessage = mutation({
  args: {
    user: v.string(), // args ensures that fnction arguments are two strings names user and body both as types and runtime values.
    body: v.string()
  },
  handler: async(ctx, args) => {
    console.log("running on server");
    // ctx.db.insert tells convex to insert a new message document into the table.
    await ctx.db.insert("messages", {
      user: args.user,
      body: args.body
    });

    if (args.body.startsWith("/wiki")){
      const topic = args.body.slice(args.body.indexOf(" ") + 1);

      // ctx.scheduler is how you cordinate async functions in convex. In the case
      // of mutations its the only way to call an action to fetch from the outside woorld.
      await ctx.scheduler.runAfter(0, internal.chat.getWikiSummary, {
        topic,
      });
    }
  },
});

export const getMessages = query({
  args: {},
  handler: async(ctx, args) => {
    const messages = await ctx.db.query("messages").order("desc").take(50);

    return messages.reverse();
  }
});


// we use internalAction because we want this function to be private to the convex
// backend and not exposed as a public API
export const getWikiSummary = internalAction({
  args: {
    topic : v.string()
  },

  handler: async(ctx, args) => {
    const res = await fetch(
      "https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro&explaintext&redirects=1&titles=" + args.topic,
    );

    const summary = getSummaryFromJSON(await res.json());

    // just like scheduling the action, we''re now scheduling our sendMessage mutation to send
    // the result of our Wikipedia lookup to our chat
    await ctx.scheduler.runAfter(0, api.chat.sendMessage, {
      user: "Wikipedia",
      body: summary
    })
  }
});

function getSummaryFromJSON(data: any) {
  const firstPageId = Object.keys(data.query.pages)[0];
  return data.query.pages[firstPageId].extract;
}