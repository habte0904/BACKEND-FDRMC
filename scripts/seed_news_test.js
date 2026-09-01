import mongoose from 'mongoose';
import dotenv from 'dotenv';
import News from '../models/News.js';
import User from '../models/User.js';

dotenv.config();

const seedNews = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for News Seeding...');

    const superAdmin = await User.findOne({ accessLevel: 'super_admin' }) || await User.findOne();
    if (!superAdmin) {
      console.error('No admin user found to attribute author');
      process.exit(1);
    }

    // Clear existing test news by slug or category
    await News.deleteMany({
      $or: [
        { slug: { $in: ['national-disaster-preparedness-campaign-launched', 'emergency-flood-warning-seasonal-readiness', 'woreda-response-team-training-workshop', 'draft-policy-brief-climate-adaptation', 'pending-article-community-emergency-grants'] } },
        { category: { $in: ['Disaster Risk Management', 'Emergency Response', 'Training', 'Announcements'] } }
      ]
    });

    const sampleArticles = [
      {
        title: 'National Disaster Preparedness Campaign Launched',
        slug: 'national-disaster-preparedness-campaign-launched',
        subtitle: 'A major initiative to enhance community resilience across all woredas',
        summary: 'Disaster management authorities have launched a comprehensive nationwide campaign focusing on early warning systems and community readiness.',
        content: `
          <p>Disaster management authorities have launched a comprehensive nationwide campaign focusing on early warning systems, emergency response protocols, and community readiness across all sectors.</p>
          <h3>Key Objectives</h3>
          <ul>
            <li>Strengthen local woreda emergency operation centers</li>
            <li>Train community response volunteers</li>
            <li>Upgrade early warning communication channels</li>
          </ul>
          <p>The campaign will run over the next six months with public workshops and simulated emergency drills.</p>
        `,
        category: 'Disaster Risk Management',
        tags: ['DisasterManagement', 'Preparedness', 'DRM', 'EarlyWarning'],
        location: 'Addis Ababa',
        coverImage: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&q=80&w=1000',
        author: superAdmin._id,
        createdBy: superAdmin._id,
        approvedBy: superAdmin._id,
        approvedAt: new Date(),
        status: 'approved',
        isFeatured: true,
        isPublished: true,
        publishedAt: new Date(),
        views: 1245,
        viewsCount: 1245,
        likes: 42,
        readingTime: 5
      },
      {
        title: 'Emergency Flood Warning & Seasonal Readiness Notice',
        slug: 'emergency-flood-warning-seasonal-readiness-notice',
        subtitle: 'Critical advisory for low-lying river basins',
        summary: 'Heavy rainfall forecasted in river basin areas. Citizens are advised to follow official evacuation procedures if alerted.',
        content: `
          <p>The meteorological department has issued an urgent warning for heavy seasonal rainfall in river basin regions.</p>
          <p>Emergency response teams have been deployed to high-risk zones. Residents are urged to store clean drinking water and keep emergency contacts ready.</p>
        `,
        category: 'Emergency Response',
        tags: ['Emergency', 'FloodWarning', 'Response'],
        location: 'Awash Basin',
        coverImage: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&q=80&w=1000',
        author: superAdmin._id,
        createdBy: superAdmin._id,
        approvedBy: superAdmin._id,
        approvedAt: new Date(),
        status: 'approved',
        isFeatured: false,
        isPublished: true,
        publishedAt: new Date(Date.now() - 86400000),
        views: 890,
        viewsCount: 890,
        likes: 19,
        readingTime: 3
      },
      {
        title: 'Woreda Response Team Training Workshop Completed',
        slug: 'woreda-response-team-training-workshop-completed',
        subtitle: 'Over 250 local experts completed advanced crisis management modules',
        summary: 'Local disaster response leaders participated in a 5-day intensive workshop covering GIS mapping and rapid victim assessment.',
        content: `
          <p>Over 250 woreda experts have successfully completed the IDRMIS disaster assessment and rapid response training series.</p>
          <p>Participants practiced offline survey data collection and real-time incident escalation.</p>
        `,
        category: 'Training',
        tags: ['Training', 'Woreda', 'CapacityBuilding'],
        location: 'Hawassa',
        coverImage: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=1000',
        author: superAdmin._id,
        createdBy: superAdmin._id,
        approvedBy: superAdmin._id,
        approvedAt: new Date(),
        status: 'approved',
        isFeatured: false,
        isPublished: true,
        publishedAt: new Date(Date.now() - 172800000),
        views: 540,
        viewsCount: 540,
        likes: 31,
        readingTime: 4
      },
      {
        title: 'Draft Policy Brief on Climate Adaptation Strategy',
        slug: 'draft-policy-brief-climate-adaptation',
        subtitle: 'Internal draft under review by Directorate',
        summary: 'This internal document outlines proposed updates to regional climate mitigation policies.',
        content: '<p>Draft internal document. Should not appear on public portal until approved.</p>',
        category: 'Climate',
        tags: ['Draft', 'Policy'],
        author: superAdmin._id,
        createdBy: superAdmin._id,
        status: 'draft',
        isFeatured: false,
        isPublished: false
      },
      {
        title: 'Pending Article on Community Emergency Grants',
        slug: 'pending-article-community-emergency-grants',
        subtitle: 'Submitted article awaiting approval',
        summary: 'Article submitted by team leader awaiting approval by Director.',
        content: '<p>Submitted article currently under review.</p>',
        category: 'Announcements',
        tags: ['Pending', 'Grants'],
        author: superAdmin._id,
        createdBy: superAdmin._id,
        status: 'pending',
        isFeatured: false,
        isPublished: false
      }
    ];

    for (const article of sampleArticles) {
      await News.create(article);
      console.log(`Created [${article.status.toUpperCase()}]: ${article.title}`);
    }

    console.log('\n✅ News seeding completed successfully!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

seedNews();
