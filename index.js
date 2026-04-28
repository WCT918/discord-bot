const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.User]
});

// ===============================
// CONFIG
// ===============================
const entryChannelId = "1498422172903931956"; // 入籍頻道
const welcomeChannelId = "1498390949351657753"; // 歡迎頻道
const announcementChannelId = "1498418934465040465"; // 公告頻道

const roleMap = {
  boy: "1498400347956187307",
  girl: "1498400468219727902",
  chill: "1498396258090356796",
  play: "1498397310390894643"
};

const citizenRoleId = "1498398881501942010";

// ===============================
// state（問卷進度）
// ===============================
const userProgress = new Map();

// 永久入口訊息 ID
let entryMessageId = null;

// ===============================
// ① Bot 上線 + 永遠只有一則入籍入口
// ===============================
client.once(Events.ClientReady, async (c) => {
  console.log(`Bot online：${c.user.tag}`);

  const channel =
    client.channels.cache.get(entryChannelId) ||
    await client.channels.fetch(entryChannelId).catch(() => null);

  if (!channel) {
    console.log("❌ 入籍頻道找不到");
    return;
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("start_register")
      .setLabel("🏝 開始比奇堡入籍")
      .setStyle(ButtonStyle.Success)
  );

  try {
    // 如果已有訊息ID，直接更新
    if (entryMessageId) {
      const oldMessage = await channel.messages.fetch(entryMessageId).catch(() => null);

      if (oldMessage) {
        await oldMessage.edit({
          content: "🏝 **比奇堡入籍系統已啟用\n準備好成為比奇堡居民了嗎~\n請開始入籍手續**",
          components: [row]
        });

        console.log("✅ 已更新既有入籍入口訊息");
        return;
      }
    }

    // 沒有則搜尋最近50則
    const messages = await channel.messages.fetch({ limit: 50 });

    const existingMessage = messages.find(
      (msg) =>
        msg.author.id === client.user.id &&
        msg.content.includes("比奇堡入籍系統已啟用\n準備好成為比奇堡居民了嗎~\n請開始入籍手續")
    );

    if (existingMessage) {
      entryMessageId = existingMessage.id;

      await existingMessage.edit({
        content: "🏝 **比奇堡入籍系統已啟用\n準備好成為比奇堡居民了嗎~\n請開始入籍手續**",
        components: [row]
      });

      console.log("✅ 找到舊入口訊息並更新");
    } else {
      // 完全沒有才新發送
      const newMessage = await channel.send({
        content: "🏝 **比奇堡入籍系統已啟用\n準備好成為比奇堡居民了嗎~\n請開始入籍手續**",
        components: [row]
      });

      entryMessageId = newMessage.id;

      console.log("✅ 已建立新的入籍入口訊息");
    }

  } catch (error) {
    console.error("❌ 入籍入口建立失敗:", error);
  }
});

// ===============================
// ② 歡迎訊息
// ===============================
const welcomeMessages = [
  "歡迎來到比奇堡，記得多冒泡，不然我們會以為你是泡泡老哥 🫧",
  "新居民出現！比奇堡的平均智商又要被影響了（？）🧠",
  "歡迎加入，比奇堡今天也不太正常 🌊",
  "有新鄰居！快來看看是不是正常的（應該不是）👀",
  "歡迎來到比奇堡，這裡專門收留奇怪的人 🐠",
  "新朋友報到成功，請準備接受混亂的海底生活 🫧",
  "歡迎加入，比奇堡的日常就是沒有日常 🌊",
  "新居民+1，海底開始變得更吵了 🎉",
  "歡迎來到比奇堡，希望你適應這裡的混亂 🐟",
  "有人加入了！快把他拖去聊天（欸）",
  "歡迎新朋友，比奇堡有多一條魚可以一起瘋了 🐟",
  "新居民出沒，請各位保持（不）冷靜 🌊",
  "歡迎來到比奇堡，這裡沒有正常人請放心 👍",
  "有新魚入海啦～大家快來圍觀 🐟",
  "新朋友登場，海底世界即將更加混亂 🫧",
  "歡迎加入，比奇堡的快樂指數+1 🐠"
];

client.on(Events.GuildMemberAdd, (member) => {
  const channel = member.guild.channels.cache.get(welcomeChannelId);
  if (!channel) return;

  const randomMessage =
    welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];

  channel.send(`👋 ${member} ${randomMessage}`);
});

// ===============================
// ③ 公告系統
// ===============================
client.on(Events.MessageCreate, (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  if (message.content.startsWith("!announce")) {
    const content = message.content.slice("!announce".length).trim();

    const channel = message.guild.channels.cache.get(announcementChannelId);
    if (!channel) return;

    channel.send(`📢 **公告**\n${content}`);
  }
});

// ===============================
// ④ 入籍系統（ephemeral 多步驟）
// ===============================
client.on(Events.InteractionCreate, async (interaction) => {

  // =========================
  // STEP 0
  // =========================
  if (interaction.isButton() && interaction.customId === "start_register") {
    userProgress.set(interaction.user.id, { step: 1, data: {} });

    return interaction.reply({
      content: "是否入籍比奇堡？",
      ephemeral: true,
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("step1_yes")
            .setLabel("我願意")
            .setStyle(ButtonStyle.Primary)
        )
      ]
    });
  }

  // =========================
  // STEP 1
  // =========================
  if (interaction.isButton() && interaction.customId === "step1_yes") {
    const state = userProgress.get(interaction.user.id) || { data: {} };

    state.step = 2;
    userProgress.set(interaction.user.id, state);

    return interaction.update({
      content: "選擇身份",
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("step2_emotion")
            .addOptions(
              { label: "愛哭男孩", value: "boy" },
              { label: "愛哭女孩", value: "girl" }
            )
        )
      ]
    });
  }

  // =========================
  // STEP 2
  // =========================
  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "step2_emotion"
  ) {
    const state = userProgress.get(interaction.user.id);

    if (!state) {
      return interaction.reply({
        content: "⚠️ 流程已過期，請重新開始",
        ephemeral: true
      });
    }

    state.data.emotion = interaction.values[0];
    state.step = 3;
    userProgress.set(interaction.user.id, state);

    return interaction.update({
      content: "選目的",
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("step3_purpose")
            .setMinValues(1)
            .setMaxValues(2)
            .addOptions(
              { label: "閒魚", value: "chill" },
              { label: "遊魚", value: "play" }
            )
        )
      ]
    });
  }

  // =========================
  // STEP 3 FINAL
  // =========================
  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "step3_purpose"
  ) {
    const state = userProgress.get(interaction.user.id);
    if (!state) return;

    state.data.purpose = interaction.values;

    const member = interaction.member;

    try {
      const rolesToAdd = [
        roleMap[state.data.emotion],
        ...state.data.purpose.map(p => roleMap[p]),
        citizenRoleId
      ].filter(Boolean);

      for (const roleId of rolesToAdd) {
        const role = interaction.guild.roles.cache.get(roleId);
        if (role) await member.roles.add(role);
      }

    } catch (err) {
      console.error(err);
    }

    userProgress.delete(interaction.user.id);

    return interaction.update({
      content: "🎉 入籍完成！",
      components: []
    });
  }
});

client.login(process.env.DISCORD_TOKEN);