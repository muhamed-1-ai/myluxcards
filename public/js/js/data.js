// Mock database for myluxcards Greeting Cards & Gift Portal

const CATEGORIES = [
  { id: 'birthday', name: 'Birthday', icon: 'cake', count: 124, gradient: 'linear-gradient(135deg, #FF6B6B, #FF8E53)' },
  { id: 'wedding', name: 'Wedding', icon: 'heart', count: 98, gradient: 'linear-gradient(135deg, #FF75B5, #FFB3D9)' },
  { id: 'anniversary', name: 'Anniversary', icon: 'sparkles', count: 85, gradient: 'linear-gradient(135deg, #7F00FF, #E100FF)' },
  { id: 'love', name: 'Love & Romance', icon: 'flame', count: 110, gradient: 'linear-gradient(135deg, #FF0844, #FFB199)' },
  { id: 'friendship', name: 'Friendship', icon: 'users', count: 64, gradient: 'linear-gradient(135deg, #FAD961, #F76B1C)' },
  { id: 'baby-shower', name: 'Baby Shower', icon: 'baby', count: 42, gradient: 'linear-gradient(135deg, #30C1D4, #73E0CD)' },
  { id: 'christmas', name: 'Christmas', icon: 'snowflake', count: 156, gradient: 'linear-gradient(135deg, #11998e, #38ef7d)' },
  { id: 'new-year', name: 'New Year', icon: 'party-popper', count: 75, gradient: 'linear-gradient(135deg, #0f2027, #203a43)' },
  { id: 'eid', name: 'Eid Mubarak', icon: 'moon', count: 58, gradient: 'linear-gradient(135deg, #0575E6, #00F260)' },
  { id: 'diwali', name: 'Diwali', icon: 'flame-kindling', count: 62, gradient: 'linear-gradient(135deg, #F35500, #FFD166)' },
  { id: 'graduation', name: 'Graduation', icon: 'graduation-cap', count: 48, gradient: 'linear-gradient(135deg, #2C3E50, #000000)' },
  { id: 'corporate', name: 'Corporate', icon: 'briefcase', count: 93, gradient: 'linear-gradient(135deg, #2193b0, #6dd5ed)' }
];

const CARDS = [
  {
    id: 1,
    title: 'Golden Sparkle Birthday',
    category: 'birthday',
    rating: 4.9,
    downloads: 1420,
    image: 'assets/cards/birthday.png',
    price: 0,
    isPremium: false,
    trending: true
  },
  {
    id: 2,
    title: 'Eucalyptus Save The Date',
    category: 'wedding',
    rating: 5.0,
    downloads: 850,
    image: 'assets/cards/wedding.png',
    price: 3.99,
    isPremium: true,
    trending: true
  },
  {
    id: 3,
    title: 'Rose Gold Fluid Anniversary',
    category: 'anniversary',
    rating: 4.8,
    downloads: 620,
    image: 'assets/cards/anniversary.png',
    price: 2.99,
    isPremium: true,
    trending: true
  },
  {
    id: 4,
    title: 'Romantic Infinite Hearts',
    category: 'love',
    rating: 4.7,
    downloads: 1205,
    image: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&auto=format&fit=crop&q=80',
    price: 0,
    isPremium: false,
    trending: true
  },
  {
    id: 5,
    title: 'Modern Festive Christmas',
    category: 'christmas',
    rating: 4.9,
    downloads: 2450,
    image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80',
    price: 0,
    isPremium: false,
    trending: true
  },
  {
    id: 6,
    title: 'Golden Confetti New Year',
    category: 'new-year',
    rating: 4.8,
    downloads: 1890,
    image: 'https://images.unsplash.com/photo-1546271876-133ac95befee?w=600&auto=format&fit=crop&q=80',
    price: 1.99,
    isPremium: true,
    trending: true
  },
  {
    id: 7,
    title: 'Royal Crescent Eid Mubarak',
    category: 'eid',
    rating: 4.9,
    downloads: 940,
    image: 'https://images.unsplash.com/photo-1564507592937-25994a9015b2?w=600&auto=format&fit=crop&q=80',
    price: 0,
    isPremium: false,
    trending: false
  },
  {
    id: 8,
    title: 'Clay Diya Sparkle Diwali',
    category: 'diwali',
    rating: 4.9,
    downloads: 1050,
    image: 'https://images.unsplash.com/photo-1605647540924-852290f6b0d5?w=600&auto=format&fit=crop&q=80',
    price: 2.49,
    isPremium: true,
    trending: true
  },
  {
    id: 9,
    title: 'Floral Watercolor Baby Shower',
    category: 'baby-shower',
    rating: 4.6,
    downloads: 410,
    image: 'https://images.unsplash.com/photo-1515488042361-404e9250afef?w=600&auto=format&fit=crop&q=80',
    price: 0,
    isPremium: false,
    trending: false
  },
  {
    id: 10,
    title: 'Classic Cap Graduation Invite',
    category: 'graduation',
    rating: 4.8,
    downloads: 530,
    image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=600&auto=format&fit=crop&q=80',
    price: 0,
    isPremium: false,
    trending: false
  },
  {
    id: 11,
    title: 'Corporate Year-End Invitation',
    category: 'corporate',
    rating: 4.7,
    downloads: 710,
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=80',
    price: 4.99,
    isPremium: true,
    trending: true
  },
  {
    id: 12,
    title: 'Elegant Friendships Everlasting',
    category: 'friendship',
    rating: 4.8,
    downloads: 880,
    image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&auto=format&fit=crop&q=80',
    price: 0,
    isPremium: false,
    trending: false
  }
];

function generateTestimonials(count) {
  const mymyluxcards = ['Avery Shaw', 'Jordan Reed', 'Taylor Brooks', 'Casey Morgan', 'Riley Quinn', 'Parker Blake', 'Morgan Ellis', 'Jamie Cole', 'Dakota Lane', 'Skyler Frost'];
  const roles = ['Marketing Lead', 'Brand Manager', 'Event Stylist', 'Creative Consultant', 'Product Designer', 'Operations Head', 'Social Media Director', 'Art Director', 'Corporate Advisor', 'Community Manager'];
  const avatars = [
    'https://placekitten.com/150/150',
    'https://placekitten.com/151/151',
    'https://placekitten.com/152/152',
    'https://placekitten.com/153/153',
    'https://placekitten.com/154/154',
    'https://placekitten.com/155/155',
    'https://placekitten.com/156/156',
    'https://placekitten.com/157/157',
    'https://placekitten.com/158/158',
    'https://placekitten.com/159/159'
  ];
  const phrases = [
    'The designs are beautifully polished and the download quality is excellent.',
    'Easy to customize, quick to share, and the final result looks premium every time.',
    'myluxcards saved us hours of design work with a stunning finished product.',
    'The editor is intuitive, the templates feel high-end, and the export was perfect.',
    'Perfect for professional networking and creative campaigns — everyone loved it.'
  ];

  return Array.from({ length: count }, (_, idx) => {
    const i = idx + 1;
    const rating = i <= 115 ? 5 : i <= 190 ? 4 : 3;
    const name = `${mymyluxcards[idx % mymyluxcards.length]} ${Math.floor(100 + idx / mymyluxcards.length)}`;
    const role = roles[idx % roles.length];
    const text = phrases[idx % phrases.length];
    const avatar = avatars[idx % avatars.length];

    return {
      id: 100 + i,
      name,
      role,
      avatar,
      rating,
      text
    };
  });
}

const TESTIMONIALS = [
  {
    id: 1,
    name: 'Priya Sharma',
    role: 'Event Planner, Mumbai',
    avatar: 'https://placekitten.com/150/150',
    rating: 5,
    text: 'myluxcards made our wedding invitation designs look premium in minutes. The NFC card preview and QR tag ordering process were so fast, we could send details to guests immediately.'
  },
  {
    id: 2,
    name: 'Anjali Gupta',
    role: 'Small Business Owner, Delhi',
    avatar: 'https://placekitten.com/151/151',
    rating: 4.9,
    text: 'The NFC keytags helped my café customers save our menu and contact details instantly. The finished design looks very modern and the upload experience was smooth.'
  },
  {
    id: 3,
    name: 'Rahul Verma',
    role: 'Startup Founder, Bengaluru',
    avatar: 'https://placekitten.com/152/152',
    rating: 4.8,
    text: 'The digital business card and QR tag packages gave our team a polished way to share contact details at events. Great for professional networking in India.'
  },
  {
    id: 4,
    name: 'Neha Joshi',
    role: 'Restaurant Owner, Pune',
    avatar: 'https://placekitten.com/153/153',
    rating: 4.6,
    text: 'Our lost-and-found QR tags are now on every table and have already helped guests reconnect with lost items. Very happy with the product quality and support.'
  },
  {
    id: 5,
    name: 'Aman Singh',
    role: 'Marketing Lead, Chennai',
    avatar: 'https://placekitten.com/154/154',
    rating: 4.4,
    text: 'The card templates feel premium and the Indian pricing was reasonable. Great for using at exhibitions and trade events — people loved tapping our NFC cards.'
  },
  {
    id: 6,
    name: 'Elena Rossi',
    role: 'Wedding Photographer',
    avatar: 'https://placekitten.com/155/155',
    rating: 3.8,
    text: 'I liked the finished design, but I found the editor a bit slow on mobile. Still, the downloadable file looked polished and my clients were happy.'
  },
  {
    id: 7,
    name: 'Noah Kim',
    role: 'Startup Founder',
    avatar: 'https://placekitten.com/156/156',
    rating: 3.2,
    text: 'Nice look and feel, but I would like more options for adding custom brand elements. Good value for quick social media invites.'
  },
  {
    id: 8,
    name: 'Aisha Hassan',
    role: 'Graphic Designer',
    avatar: 'https://placekitten.com/157/157',
    rating: 3.5,
    text: 'The designs are elegant, but the preview can be a little sticky when switching between layouts. Overall it is useful for fast draft concepts.'
  },
  {
    id: 9,
    name: 'Leo Martin',
    role: 'First-time User',
    avatar: 'https://placekitten.com/158/158',
    rating: 2.8,
    text: 'The interface is attractive, but I struggled to find the right card size option. Once I found it, the final card output was much better than expected.'
  }
].concat(generateTestimonials(200));

const FAQS = [
  {
    question: 'How do I customize a template?',
    answer: 'Browse the catalog, select a design, and update the card text and colors for a polished, personalized result. Your chosen layout can then be added to cart and downloaded instantly.'
  },
  {
    question: 'Are the card downloads print-ready?',
    answer: 'Yes! Downloads are delivered as high-resolution PNG files that are ready to print clearly on premium card stock.'
  },
  {
    question: 'What is the difference between Free and Premium cards?',
    answer: 'Free cards can be edited and downloaded without any charge or watermarks. Premium cards are designed by professional illustrators and can be unlocked individually or accessed through our Premium subscription plan.'
  },
  {
    question: 'Can I upload custom fonts or stickers?',
    answer: 'We provide a curated collection of elegant, handpicked design options that maintain a premium luxury aesthetic.'
  },
  {
    question: 'Do you offer physical delivery of greeting cards?',
    answer: 'myluxcards is primarily an instant-download digital design platform. However, we have partners linked in the download panel who offer luxury paper printing and envelope shipping services for your custom designs.'
  }
];

// Export to window object for browser access
window.LuxData = {
  CATEGORIES,
  CARDS,
  TESTIMONIALS,
  FAQS
};
