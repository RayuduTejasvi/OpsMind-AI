import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    citations: {
      type: [
        {
          filename: { type: String, required: true },
          page: { type: Number, default: 1 },
          section: { type: String, default: '' },
        },
      ],
      default: [],
    },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const chatSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true },
    messages: { type: [messageSchema], default: [] },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['employee', 'admin'], default: 'employee' },
    planTier: { type: String, enum: ['free', 'pro'], default: 'free' },
    stripeCustomerId: { type: String, default: '' },
    queryCountToday: { type: Number, default: 0 },
    queryResetAt: { type: Date, default: Date.now },
    chatHistory: { type: [chatSessionSchema], default: [] },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
