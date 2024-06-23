import { HandlerContext } from "@xmtp/message-kit";
export async function handler(context: HandlerContext) {
  const {
    members,
    message: {
      content: { content, params, action, referenceInboxId: receiver },
      senderInboxId,
      typeId,
    },
  } = context;

  let amount: number = 0,
    receiverAddresses: string[] = [];
  // Handle different types of messages
  if (typeId === "reply") {
    // Process reply messages
    receiverAddresses = [receiver];
    if (content.includes("$degen")) {
      const match = content.match(/(\d+)/);
      if (match) amount = parseInt(match[0]); // Extract amount from reply
    }
  } else if (typeId === "text") {
    // Process text commands starting with "/tip"
    if (content.startsWith("/tip")) {
      const { amount: extractedAmount, username } = params;
      amount = extractedAmount || 10; // Default amount if not specified
      receiverAddresses = username; // Extract receiver from parameters
    }
  } else if (typeId === "reaction") {
    // Process reactions, specifically tipping added reactions
    if ((content === "🎩" || content === "degen") && action === "added") {
      amount = 10; // Set a fixed amount for reactions
      receiverAddresses = [receiver];
    }
  }
  // Find sender user details
  const senderUser = members?.find(
    (user: any) => user.inboxId === senderInboxId,
  );

  if (!senderUser || receiverAddresses.length === 0 || amount === 0) {
    context.reply("Sender or receiver or amount not found.");
    return;
  }

  // Process sending tokens to each receiver
  receiverAddresses.forEach(async (receiver: any) => {
    context.reply(
      `You received ${amount} tokens from ${senderUser.username}.`,
      [receiver?.address], // Notify only 1 address
    );
  });
  // Notify sender of the transaction details
  context.reply(
    `You sent ${amount * receiverAddresses.length} tokens in total.`,
    [senderInboxId!], // Notify only 1 address //  [!code hl] // [!code focus]
  );
}
