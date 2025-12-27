// src/models/ChatMessage.js
module.exports = (sequelize) => {
    const { DataTypes } = require('sequelize');
  
    const ChatMessage = sequelize.define('ChatMessage', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      sender_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      receiver_id: {
        type: DataTypes.UUID,
        allowNull: true, // Nullable for group messages
      },
      group_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      channel_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      is_read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      // Reactions stored as JSON: { "👍": ["user_id_1"], "❤️": ["user_id_2", "user_id_3"] }
      reactions: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
      // Reply threading
      reply_to_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      // Message flags
      is_pinned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      is_starred: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      is_edited: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      is_deleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      // Attachments
      attachment_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      attachment_type: {
        type: DataTypes.STRING, // 'image', 'video', 'audio', 'file'
        allowNull: true,
      },
    }, {
      tableName: 'chat_messages',
      timestamps: true, // creates createdAt, updatedAt
    });
  
    return ChatMessage;
  };
