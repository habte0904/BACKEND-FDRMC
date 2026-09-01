import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  fullname: String,
  email: { type: String, unique: true },
  phone: { type: String, unique: true, sparse: true },
  passwordHash: String,
  profileImage: String, // Path to profile image
  status: { type: String, default: 'pending' }, // pending | active | suspended
  roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  sector: { type: mongoose.Schema.Types.ObjectId, ref: 'Sector' },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  verificationCode: String,
  verificationExpires: Date,

  // Hierarchical Access Control Fields
  accessLevel: {
    type: String,
    enum: [
      'super_admin',      // Head Office - Super Admin
      'manager',          // Head Office/Branch - Manager
      'deputy',           // Head Office - Deputy
      'sector_lead',      // Head Office - Sector Lead
      'directorate',      // Head Office/Branch - Directorate
      'team_leader',      // Head Office/Branch - Team Leader
      'expert',           // Head Office/Branch - Expert
      'branch_admin',      // Branch - Branch Admin
      'public',           // Public - Public User
    ],
    default: 'public'
  },

  organizationType: {
    type: String,
    enum: ['head_office', 'branch'],
    default: 'branch'
  },

  // Delegation tracking
  delegatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  delegatedAuthority: {
    canManageTeams: { type: Boolean, default: false },
    canManageDepartments: { type: Boolean, default: false },
    canApproveReports: { type: Boolean, default: false },
    expiresAt: Date
  },

  // Reporting hierarchy
  reportsTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Team assignment (for Team Leaders and Experts)
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  },

  // Managed entities (for Directorates and Team Leaders)
  managedDepartments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  }],

  managedTeams: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  }],

  onboarding: {
    welcomeShown: Boolean,
    profileCompleted: Boolean,
    acceptedTerms: Boolean
  },
  lastLogin: Date
}, { timestamps: true });

export default mongoose.model('User', userSchema);
