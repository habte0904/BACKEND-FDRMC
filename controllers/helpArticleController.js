import HelpArticle from '../models/HelpArticle.js';
import jwt from 'jsonwebtoken';
import * as userService from '../services/userService.js';

// Helper to check if requesting user is an administrator
const isUserAdmin = async (req) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await userService.getUserById(decoded.id);
      if (user && user.status === 'active' && user.roles) {
        return user.roles.some((r) =>
          ['admin', 'super admin', 'superadmin', 'super_admin', 'branch admin', 'branch_admin'].includes(
            (r.name || '').toLowerCase()
          )
        );
      }
    } catch {
      return false;
    }
  }
  return false;
};

// Helper slug generator
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
};

/**
 * GET /api/help
 * Fetch all published help articles filtered by user permissions
 */
export const getHelpArticles = async (req, res) => {
  try {
    const isAdmin = await isUserAdmin(req);
    const { category, search, includeDrafts } = req.query;

    const query = {};

    // Only published articles are shown in the help center
    if (includeDrafts !== 'true') {
      query.status = 'published';
    }

    // If not admin, restrict visibility to 'everyone'
    if (!isAdmin) {
      query.visibility = 'everyone';
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [{ title: regex }, { summary: regex }, { tags: regex }, { category: regex }];
    }

    const articles = await HelpArticle.find(query)
      .sort({ order: 1, createdAt: -1 })
      .lean();

    res.json(articles);
  } catch (error) {
    console.error('Error fetching help articles:', error);
    res.status(500).json({ message: 'Failed to fetch help articles', error: error.message });
  }
};

/**
 * GET /api/help/admin/all
 * Admin-specific endpoint to get all articles (including drafts & admin-only)
 */
export const getAdminHelpArticles = async (req, res) => {
  try {
    const articles = await HelpArticle.find()
      .sort({ order: 1, createdAt: -1 })
      .lean();
    res.json(articles);
  } catch (error) {
    console.error('Error fetching admin help articles:', error);
    res.status(500).json({ message: 'Failed to fetch admin help articles', error: error.message });
  }
};

/**
 * GET /api/help/:slugOrId
 * Fetch single article detail by slug or ID
 */
export const getHelpArticleBySlugOrId = async (req, res) => {
  try {
    const { slugOrId } = req.params;
    const isAdmin = await isUserAdmin(req);

    let article = await HelpArticle.findOne({ slug: slugOrId }).lean();
    if (!article && slugOrId.match(/^[0-9a-fA-F]{24}$/)) {
      article = await HelpArticle.findById(slugOrId).lean();
    }

    if (!article) {
      return res.status(404).json({ message: 'Help article not found' });
    }

    // Access control validation
    if (article.visibility === 'admin_only' && !isAdmin) {
      return res.status(403).json({ message: 'Access denied. This article is restricted to administrators.' });
    }

    if (article.status === 'draft' && !isAdmin) {
      return res.status(404).json({ message: 'Article is not published' });
    }

    res.json(article);
  } catch (error) {
    console.error('Error fetching article detail:', error);
    res.status(500).json({ message: 'Failed to fetch article detail', error: error.message });
  }
};

/**
 * POST /api/help
 * Create new help article (Admin only)
 */
export const createHelpArticle = async (req, res) => {
  try {
    const { title, summary, content, category, visibility, status, order, tags } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }

    let baseSlug = slugify(title);
    if (!baseSlug) baseSlug = `article-${Date.now()}`;

    // Ensure unique slug
    let uniqueSlug = baseSlug;
    let count = 1;
    while (await HelpArticle.exists({ slug: uniqueSlug })) {
      uniqueSlug = `${baseSlug}-${count++}`;
    }

    const article = new HelpArticle({
      title,
      slug: uniqueSlug,
      summary: summary || '',
      content,
      category: category || 'General',
      visibility: visibility === 'admin_only' ? 'admin_only' : 'everyone',
      status: status === 'draft' ? 'draft' : 'published',
      order: order ? Number(order) : 0,
      tags: Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',').map((t) => t.trim()) : [],
      author: req.user?._id || req.user?.id,
      authorName: req.user?.fullname || 'System Administrator',
    });

    await article.save();
    res.status(201).json(article);
  } catch (error) {
    console.error('Error creating help article:', error);
    res.status(500).json({ message: 'Failed to create help article', error: error.message });
  }
};

/**
 * PUT /api/help/:id
 * Update an existing help article (Admin only)
 */
export const updateHelpArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, summary, content, category, visibility, status, order, tags } = req.body;

    const article = await HelpArticle.findById(id);
    if (!article) {
      return res.status(404).json({ message: 'Help article not found' });
    }

    if (title && title !== article.title) {
      article.title = title;
      let baseSlug = slugify(title);
      let uniqueSlug = baseSlug;
      let count = 1;
      while (await HelpArticle.exists({ slug: uniqueSlug, _id: { $ne: article._id } })) {
        uniqueSlug = `${baseSlug}-${count++}`;
      }
      article.slug = uniqueSlug;
    }

    if (summary !== undefined) article.summary = summary;
    if (content !== undefined) article.content = content;
    if (category !== undefined) article.category = category;
    if (visibility !== undefined) article.visibility = visibility === 'admin_only' ? 'admin_only' : 'everyone';
    if (status !== undefined) article.status = status;
    if (order !== undefined) article.order = Number(order);
    if (tags !== undefined) {
      article.tags = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',').map((t) => t.trim()) : [];
    }

    await article.save();
    res.json(article);
  } catch (error) {
    console.error('Error updating help article:', error);
    res.status(500).json({ message: 'Failed to update help article', error: error.message });
  }
};

/**
 * DELETE /api/help/:id
 * Delete help article (Admin only)
 */
export const deleteHelpArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const article = await HelpArticle.findByIdAndDelete(id);
    if (!article) {
      return res.status(404).json({ message: 'Help article not found' });
    }
    res.json({ message: 'Help article deleted successfully' });
  } catch (error) {
    console.error('Error deleting help article:', error);
    res.status(500).json({ message: 'Failed to delete help article', error: error.message });
  }
};

/**
 * Seed initial default starter guides if collection is empty
 */
export const seedDefaultHelpArticles = async () => {
  try {
    const count = await HelpArticle.countDocuments();
    if (count > 0) return;

    const seedArticles = [
      {
        title: 'Getting Started with PDRM Situational Platform',
        slug: 'getting-started-with-pdrm-platform',
        category: 'General',
        summary: 'Overview of the disaster risk management portal, navigation, and key workflows.',
        content: `### Welcome to the PDRM Disaster Risk Management System

The PDRM Platform is an integrated disaster risk reduction, early warning, situational monitoring, and emergency response management portal.

#### Key Features & Quick Navigation:
- **Live Situational Dashboard**: Access real-time GIS mapping, incident severity analytics, and response activities.
- **Site Survey Module**: Offline-capable mobile PWA data collection for field inspectors and disaster response teams.
- **Disaster Risk Database**: Comprehensive woreda profiles, multi-hazard risk indices, and community vulnerability records.
- **Public Portal**: Citizen incident reporting, safety inspections, community alerts, and official flood forecasts.

For technical assistance or role permission upgrades, please contact your System Administrator.`,
        visibility: 'everyone',
        status: 'published',
        order: 1,
        tags: ['getting started', 'overview', 'navigation'],
      },
      {
        title: 'Live Situational Dashboard & Screen Layout Customizer',
        slug: 'live-dashboard-and-screen-customizer',
        category: 'Live Dashboard',
        summary: 'Learn how to customize card widths, drag to reorder, and save multi-screen configurations.',
        content: `### Mastering the FDRMC Live Dashboard

The Live Dashboard provides real-time situational awareness across Addis Ababa and regional zones.

#### 1. Customizing Layouts & Card Widths
- Click the **"Layout & Displays"** button in the dashboard toolbar.
- Choose from presets like **Command Grid**, **2-Column**, or **3-Column Grid**.
- Customize individual card spans from **1/4 (25%)**, **1/3 (33%)**, **1/2 (50%)**, **2/3 (66%)**, or **Full (100%)**.

#### 2. Drag to Reorder Cards
- Grab the **⠿ Grip Handle** on the left of any card row in the Layout Manager.
- Drag up or down to set your preferred priority order. Dropping immediately updates the live dashboard.

#### 3. Managing Multi-Screen Display Walls
- Click **"+ Add Screen Configuration"** to save customized card sequences for specific TV command walls.
- Switch between screen profiles instantly anytime.`,
        visibility: 'everyone',
        status: 'published',
        order: 2,
        tags: ['live dashboard', 'grid layout', 'drag and drop', 'screen profiles'],
      },
      {
        title: 'Administrator Guide: User Roles, Permissions & Security',
        slug: 'admin-guide-user-roles-and-permissions',
        category: 'Admin Guides',
        summary: 'Strictly for administrators: Managing system users, department hierarchies, and role permissions.',
        content: `### PDRM Administrator Security & Role Management

> **RESTRICTED**: This documentation is strictly for authorized System Administrators.

#### 1. Role & Permission Management
- Navigate to **Admin -> Roles & Permissions** in the sidebar.
- Assign granular capabilities for template creation, response approvals, woreda profile validation, and audit inspections.

#### 2. User Provisioning & Hierarchy
- Create user accounts assigned to specific **Departments**, **Sectors**, and **Subcity/Woreda** operational scopes.
- Branch Admins can manage users within their assigned operational domain.

#### 3. Audit Logs & System Monitoring
- Regularly inspect **Admin -> Audit Logs** to track administrative modifications, role alterations, and data exports.`,
        visibility: 'admin_only',
        status: 'published',
        order: 3,
        tags: ['admin', 'security', 'roles', 'permissions', 'audit'],
      },
    ];

    await HelpArticle.insertMany(seedArticles);
    console.log('[HelpArticle] Seeded default help articles successfully.');
  } catch (err) {
    console.error('[HelpArticle] Error seeding default help articles:', err);
  }
};
