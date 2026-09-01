import mongoose from 'mongoose';

const HeroSlideSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    subtitle: { type: String, trim: true, default: '' },
    image: { type: String, trim: true, default: '' },
    iconKey: { type: String, trim: true, default: '' },
    disabled: { type: Boolean, default: false },
  },
  { _id: false }
);

const PortalFeatureSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    iconKey: { type: String, trim: true, default: '' },
    color: { type: String, trim: true, default: '' },
    disabled: { type: Boolean, default: false },
  },
  { _id: false }
);

const PortalServiceSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    slug: { type: String, trim: true, default: '' },
    templateSearch: { type: String, trim: true, default: '' },
    moduleContextType: { type: String, trim: true, default: '' },
    iconKey: { type: String, trim: true, default: '' },
    color: { type: String, trim: true, default: '' },
    disabled: { type: Boolean, default: false },
  },
  { _id: false }
);

const PortalContentSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'default' },
    branding: {
      orgName: { type: String, trim: true, default: '' },
      portalName: { type: String, trim: true, default: '' },
      logoUrl: { type: String, trim: true, default: '' },
    },
    header: {
      navLinks: {
        type: [
          new mongoose.Schema(
            {
              label: { type: String, trim: true, default: '' },
              href: { type: String, trim: true, default: '' },
              disabled: { type: Boolean, default: false },
            },
            { _id: false }
          ),
        ],
        default: [],
      },
      ctaLabel: { type: String, trim: true, default: '' },
      ctaHref: { type: String, trim: true, default: '' },
    },
    sectionsVisibility: {
      header: { type: Boolean, default: true },
      hero: { type: Boolean, default: true },
      about: { type: Boolean, default: true },
      services: { type: Boolean, default: true },
      features: { type: Boolean, default: true },
      feedback: { type: Boolean, default: true },
      contact: { type: Boolean, default: true },
      footer: { type: Boolean, default: true },
    },
    hero: {
      slides: { type: [HeroSlideSchema], default: [] },
      primaryCta: {
        label: { type: String, trim: true, default: '' },
        href: { type: String, trim: true, default: '' },
      },
      secondaryCta: {
        label: { type: String, trim: true, default: '' },
        href: { type: String, trim: true, default: '' },
      },
    },
    about: {
      title: { type: String, trim: true, default: '' },
      description: { type: String, trim: true, default: '' },
      badge: { type: String, trim: true, default: '' },
      items: {
        type: [
          new mongoose.Schema(
            {
              title: { type: String, trim: true, default: '' },
              description: { type: String, trim: true, default: '' },
              iconKey: { type: String, trim: true, default: '' },
              disabled: { type: Boolean, default: false },
            },
            { _id: false }
          ),
        ],
        default: [],
      },
    },
    featuresSection: {
      heading: { type: String, trim: true, default: '' },
      subheading: { type: String, trim: true, default: '' },
      badge: { type: String, trim: true, default: '' },
      features: { type: [PortalFeatureSchema], default: [] },
    },
    servicesSection: {
      heading: { type: String, trim: true, default: '' },
      subheading: { type: String, trim: true, default: '' },
      services: { type: [PortalServiceSchema], default: [] },
    },
    newsSection: {
      heading: { type: String, trim: true, default: '' },
      subheading: { type: String, trim: true, default: '' },
      tickerText: { type: String, trim: true, default: '' },
      items: {
        type: [
          new mongoose.Schema(
            {
              title: { type: String, trim: true, default: '' },
              description: { type: String, trim: true, default: '' },
              href: { type: String, trim: true, default: '' },
              disabled: { type: Boolean, default: false },
            },
            { _id: false }
          ),
        ],
        default: [],
      },
    },
    services: { type: [PortalServiceSchema], default: [] },
    contact: {
      email: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
      address: { type: String, trim: true, default: '' },
    },
    footer: {
      headings: {
        quickLinks: { type: String, trim: true, default: '' },
        connect: { type: String, trim: true, default: '' },
        newsletter: { type: String, trim: true, default: '' },
      },
      blurb: { type: String, trim: true, default: '' },
      newsletter: {
        text: { type: String, trim: true, default: '' },
        placeholder: { type: String, trim: true, default: '' },
        buttonLabel: { type: String, trim: true, default: '' },
      },
      badges: {
        type: [
          new mongoose.Schema(
            {
              text: { type: String, trim: true, default: '' },
              iconKey: { type: String, trim: true, default: '' },
              disabled: { type: Boolean, default: false },
            },
            { _id: false }
          ),
        ],
        default: [],
      },
      quickLinks: {
        type: [
          new mongoose.Schema(
            {
              label: { type: String, trim: true, default: '' },
              href: { type: String, trim: true, default: '' },
              highlight: { type: Boolean, default: false },
              disabled: { type: Boolean, default: false },
            },
            { _id: false }
          ),
        ],
        default: [],
      },
      socials: {
        type: [
          new mongoose.Schema(
            {
              label: { type: String, trim: true, default: '' },
              href: { type: String, trim: true, default: '' },
              iconKey: { type: String, trim: true, default: '' },
              disabled: { type: Boolean, default: false },
            },
            { _id: false }
          ),
        ],
        default: [],
      },
      bottomLinks: {
        type: [
          new mongoose.Schema(
            {
              label: { type: String, trim: true, default: '' },
              href: { type: String, trim: true, default: '' },
              disabled: { type: Boolean, default: false },
            },
            { _id: false }
          ),
        ],
        default: [],
      },
      copyrightText: { type: String, trim: true, default: '' },
    },
    pages: {
      feedback: {
        title: { type: String, trim: true, default: '' },
        subtitle: { type: String, trim: true, default: '' },
        templateSearch: { type: String, trim: true, default: '' },
        heroImage: { type: String, trim: true, default: '' },
      },
      emergencyDirectory: {
        warningMessage: { type: String, trim: true, default: '' },
      },
    },
  },
  { timestamps: true }
);

export default mongoose.model('PortalContent', PortalContentSchema);
