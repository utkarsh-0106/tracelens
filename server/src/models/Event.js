import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
  session_id: { type: String, required: true, trim: true, index: true },
  event_type: { type: String, required: true, enum: ["page_view", "click"], index: true },
  page_url: { type: String, required: true, trim: true, index: true },
  timestamp: { type: Date, required: true, index: true },
  coordinates: {
    x: { type: Number, min: 0 },
    y: { type: Number, min: 0 }
  },
  viewport: {
    width: { type: Number, min: 1 },
    height: { type: Number, min: 1 }
  },
  scroll: {
    x: { type: Number, min: 0 },
    y: { type: Number, min: 0 }
  }
}, { versionKey: false });

eventSchema.index({ session_id: 1, timestamp: 1 });
eventSchema.index({ page_url: 1, event_type: 1, timestamp: -1 });

export const Event = mongoose.model("Event", eventSchema);
