const mongoose = require('mongoose');

/**
 * Event Schema
 * Implements SPEC.md Section 2 - Calendar Data Source Fields:
 * - eventId
 * - summary
 * - description
 * - start
 * - end
 * - attendees
 * - organizer
 * - location
 */
const AttendeeSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    responseStatus: { type: String, default: 'needsAction' },
    displayName: { type: String, default: '' }
  },
  { _id: false }
);

const EventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    summary: {
      type: String,
      default: ''
    },
    description: {
      type: String,
      default: ''
    },
    start: {
      type: Date,
      required: true,
      index: true
    },
    end: {
      type: Date,
      required: true
    },
    attendees: {
      type: [AttendeeSchema],
      default: []
    },
    organizer: {
      type: String,
      default: ''
    },
    location: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Event', EventSchema);
