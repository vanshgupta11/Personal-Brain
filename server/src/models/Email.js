const mongoose = require('mongoose');

/**
 * Email Schema
 * Implements SPEC.md Section 2 - Gmail Data Source Fields:
 * - threadId
 * - messageId
 * - from
 * - to
 * - subject
 * - snippet
 * - bodyText
 * - date
 * - hasAttachments
 * - labels
 */
const EmailSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    threadId: {
      type: String,
      required: true,
      index: true
    },
    messageId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    from: {
      type: String,
      required: true
    },
    to: {
      type: [String],
      default: []
    },
    subject: {
      type: String,
      default: ''
    },
    snippet: {
      type: String,
      default: ''
    },
    bodyText: {
      type: String,
      default: ''
    },
    date: {
      type: Date,
      required: true,
      index: true
    },
    hasAttachments: {
      type: Boolean,
      default: false
    },
    labels: {
      type: [String],
      default: [],
      index: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Email', EmailSchema);
