import React, { useState, useEffect, useRef } from 'react';
import './PublicHome.css';
import { FiZap, FiSearch, FiSave, FiCheckCircle, FiArrowRight, FiUsers, FiGitMerge, FiCalendar, FiMessageCircle, FiFileText, FiInbox, FiGlobe, FiLayers, FiShield } from 'react-icons/fi';
import { FaGithub, FaSlack, FaTwitter, FaLinkedin, FaReact, FaNodeJs, FaCode, FaRocket } from 'react-icons/fa';

const PublicHome = () => {
    // State to control intro visibility
    const [showIntroOnly, setShowIntroOnly] = useState(true);
    // State for code animation
    const [codeText, setCodeText] = useState('');
    const [lineCount, setLineCount] = useState(10);
    // State for animated elements
    const [isVisible, setIsVisible] = useState({});
    // State for which code line is currently being typed
    const [currentTypingLine, setCurrentTypingLine] = useState(0);
    // State to control blinking cursor position
    const [cursorPosition, setCursorPosition] = useState({ line: 0, char: 0 });

    // Refs for intersection observer
    const sectionRefs = useRef({});

    // Modern API developer workspace illustration
    const heroImageUrl = 'https://images.unsplash.com/photo-1587620962725-abab7fe55159?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1000&q=80';

    // Team collaboration image
    const collaborationImageUrl = 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';

    // Knowledge management image
    const knowledgeImageUrl = 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';

    // Set up intersection observer for animations
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        setIsVisible(prev => ({ ...prev, [entry.target.id]: true }));
                    }
                });
            },
            { threshold: 0.1 }
        );

        // Observe all section refs
        Object.values(sectionRefs.current).forEach(ref => {
            if (ref) observer.observe(ref);
        });

        return () => {
            if (observer) {
                observer.disconnect();
            }
        };
    }, []);

    // Typing animation for code
    useEffect(() => {
        // Start typing animation after a short delay
        const timer = setTimeout(() => {
            startTypingAnimation();
        }, 1500);

        return () => clearTimeout(timer);
    }, []);

    // Function to simulate typing animation for code editor
    const startTypingAnimation = () => {
        const codeLines = codeExample.split('\n');
        let lineIndex = 0;
        let charIndex = 0;

        const typingInterval = setInterval(() => {
            if (lineIndex < codeLines.length) {
                // Update cursor position
                setCursorPosition({ line: lineIndex, char: charIndex });

                if (charIndex === 0) {
                    // When starting a new line
                    setCurrentTypingLine(lineIndex);
                }

                if (charIndex < codeLines[lineIndex].length) {
                    // Type next character
                    charIndex++;
                } else {
                    // Move to next line
                    lineIndex++;
                    charIndex = 0;

                    // Add a slight pause between lines for realism
                    return;
                }
            } else {
                // Typing complete
                clearInterval(typingInterval);

                // Set cursor to the end of the code
                setCursorPosition({
                    line: codeLines.length - 1,
                    char: codeLines[codeLines.length - 1].length
                });
            }
        }, 30); // Adjust typing speed here

        return () => clearInterval(typingInterval);
    };

    // Function to handle "Learn More" button click
    const handleLearnMoreClick = (e) => {
        e.preventDefault();
        setShowIntroOnly(false);

        // Scroll to features section
        const featuresSection = document.getElementById('features');
        if (featuresSection) {
            featuresSection.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Example code for animation - showcasing the product features with better organization
    const codeExample = `// Pigeon - The Everything App for teams
import { Workspace, Project, Chat, Document } from 'pigeon';

// Create a new team workspace
const teamWorkspace = new Workspace({
  name: 'Engineering Team',
  members: ['alex@company.com', 'taylor@company.com']
});

// Create a new project with tasks
const newFeature = new Project({
  title: 'Launch New Feature',
  description: 'Implement and deploy the billing module',
  dueDate: '2025-06-15',
  priority: 'high'
});

// Add tasks to the project
newFeature.addTask({
  title: 'Frontend Implementation',
  assignee: 'alex@company.com'
});

newFeature.addTask({
  title: 'Backend API Development',
  assignee: 'taylor@company.com'
});

// Create team communication
const engineeringChat = new Chat({
  name: 'engineering',
  isPublic: false
});

// Send message with attachment
engineeringChat.sendMessage({
  content: 'The new feature specs are ready!',
  attachments: ['specs.pdf']
});

// Create and share documentation
const doc = new Document({
  title: 'Feature Implementation Guide',
  content: '# Getting Started\\n...'
});

// Share document with the team
doc.share(teamWorkspace);

// Export project data
const csvData = newFeature.exportTasks('csv');
console.log('Tasks exported successfully!');`;

    // Generate line numbers for code display
    const generateLineNumbers = (count) => {
        return Array.from({ length: count }, (_, i) => i + 1);
    };

    // Add a reference to a section
    const addSectionRef = (id, element) => {
        if (element && !sectionRefs.current[id]) {
            sectionRefs.current[id] = element;
            element.id = id;
        }
    };

    // Add animated class if element is visible
    const getAnimationClass = (id) => {
        return isVisible[id] ? 'animate-in' : 'pre-animation';
    };

    return (
        <div className={`public-home-container ${showIntroOnly ? 'intro-active' : ''}`}>

            <div className="intro-section-full-width">
                {/* Floating badges */}
                <div className="intro-section-badges">
                    <span className="intro-badge">Project Management</span>
                    <span className="intro-badge">Team Communication</span>
                    <span className="intro-badge">Document Collaboration</span>
                    <span className="intro-badge">Task Tracking</span>
                </div>

                <div className="intro-section-container">
                    <div className="intro-content">
                        <h1 className="intro-heading">Everything App for your teams</h1>
                        <p className="intro-description">
                            <strong>Pigeon</strong> is an open-source platform that serves as an all-in-one replacement of <strong>Linear</strong>, <strong>Jira</strong>, <strong>Slack</strong>, and <strong>Notion</strong>. Streamline your workflow with a single unified experience.
                        </p>
                        <div className="intro-buttons">
                            <a href="#" className="intro-button intro-button-primary">TRY IT FREE</a>
                            <a href="#features" onClick={handleLearnMoreClick} className="intro-button intro-button-secondary">Learn More</a>
                        </div>

                        {/* Tech stack icons */}
                        <div className="tech-stack">
                            <div className="tech-stack-title">Built with</div>
                            <div className="tech-icons">
                                <FaReact title="React" />
                                <FaNodeJs title="Node.js" />
                                <FaCode title="Modern JavaScript" />
                                <FaRocket title="High Performance" />
                            </div>
                        </div>
                    </div>

                    {/* Enhanced code editor with animation */}
                    <div className="intro-code-container">
                        <div className="code-editor-header">
                            <div className="window-controls">
                                <div className="window-control window-close"></div>
                                <div className="window-control window-minimize"></div>
                                <div className="window-control window-maximize"></div>
                            </div>
                            <div className="file-tab active">workspace.js</div>
                            <div className="file-tab">project.js</div>
                        </div>
                        <div className="code-editor-body">
                            <div className="line-numbers">
                                {generateLineNumbers(codeExample.split('\n').length).map((num) => (
                                    <div key={num}>{num}</div>
                                ))}
                            </div>
                            <div className="code-content">
                                {codeExample.split('\n').map((line, index) => {
                                    // Apply syntax highlighting with regex
                                    // const processedLine = line
                                    //     .replace(/(import|const|new|from|if|return|export)/g, '<span class="keyword">$1</span>')
                                    //     .replace(/(Workspace|Project|Chat|Document|addTask|sendMessage|share|exportTasks)/g, '<span class="function">$1</span>')
                                    //     .replace(/('.*?'|".*?"|\[.*?\])/g, '<span class="string">$1</span>')
                                    //     .replace(/(\d+)/g, '<span class="number">$1</span>')
                                    //     .replace(/(\/\/.*)/g, '<span class="comment">$1</span>')
                                    //     .replace(/(name|title|description|dueDate|priority|assignee|content|attachments|isPublic|members)/g, '<span class="property">$1</span>');

                                    const isTyping = index <= currentTypingLine;
                                    const showCursor = index === cursorPosition.line;

                                    // Only show typed characters up to cursor position
                                    let displayLine = line;
                                    if (index === cursorPosition.line) {
                                        displayLine = line.substring(0, cursorPosition.char);
                                    } else if (index > currentTypingLine) {
                                        displayLine = ''; // Don't show lines that haven't been typed yet
                                    }

                                    const processedDisplayLine = displayLine
                                        .replace(/(import|const|new|from|if|return|export)/g, '<span class="keyword">$1</span>')
                                        .replace(/(Workspace|Project|Chat|Document|addTask|sendMessage|share|exportTasks)/g, '<span class="function">$1</span>')
                                        .replace(/('.*?'|".*?"|\[.*?\])/g, '<span class="string">$1</span>')
                                        .replace(/(\d+)/g, '<span class="number">$1</span>')
                                        .replace(/(\/\/.*)/g, '<span class="comment">$1</span>')
                                        .replace(/(name|title|description|dueDate|priority|assignee|content|attachments|isPublic|members)/g, '<span class="property">$1</span>');

                                    return (
                                        <div
                                            key={index}
                                            className={`code-line ${isTyping ? 'typed' : ''}`}
                                        >
                                            <span dangerouslySetInnerHTML={{ __html: processedDisplayLine }} />
                                            {showCursor && <span className="code-cursor"></span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Productivity Section */}
            <section
                id="features"
                className={`productivity-section ${getAnimationClass('features')}`}
                ref={(el) => addSectionRef('features', el)}
            >
                <div className="section-header">
                    <h2>Everything you need for productive team work</h2>
                    <p className="section-subtitle">Team Planner • Project Management • Virtual Office • Chat • Documents • Inbox</p>
                </div>

                <div className="productivity-features-grid">
                    <div className="productivity-feature-card">
                        <div className="feature-icon-container">
                            <FiZap className="feature-icon" />
                        </div>
                        <h3>Keyboard Shortcuts</h3>
                        <p>Work efficiently with instant access to common actions.</p>
                    </div>
                    <div className="productivity-feature-card">
                        <div className="feature-icon-container">
                            <FiCalendar className="feature-icon" />
                        </div>
                        <h3>Team Planner</h3>
                        <p>Keep track of the bigger picture by viewing all API endpoints in one centralized dashboard.</p>
                    </div>
                    <div className="productivity-feature-card">
                        <div className="feature-icon-container">
                            <FiInbox className="feature-icon" />
                        </div>
                        <h3>Notifications</h3>
                        <p>Keep up to date with any API changes by receiving instant notifications.</p>
                    </div>
                    <div className="productivity-feature-card">
                        <div className="feature-icon-container">
                            <FiSearch className="feature-icon" />
                        </div>
                        <h3>Advanced Filtering</h3>
                        <p>Precise API search with advanced filtering capabilities.</p>
                    </div>
                </div>
            </section>

            {/* Collaboration Section with Image */}
            <section
                className={`collaboration-section ${getAnimationClass('collaboration')}`}
                ref={(el) => addSectionRef('collaboration', el)}
            >
                <div className="collaboration-content">
                    <h2>Work Together. Like in the Office.</h2>
                    <p className="collaboration-description">
                        Create customized virtual workspace for any team working with APIs. Collaborate with remote teams seamlessly through real-time communication within your workspace.
                    </p>
                    <div className="collaboration-features">
                        <div className="collab-feature-item">
                            <div className="collab-feature-icon">
                                <FiUsers className="icon" />
                            </div>
                            <div className="collab-feature-text">
                                <h3>Team Collaboration</h3>
                                <p>Connect with your team instantly to monitor progress and track API updates.</p>
                            </div>
                        </div>
                        <div className="collab-feature-item">
                            <div className="collab-feature-icon">
                                <FiMessageCircle className="icon" />
                            </div>
                            <div className="collab-feature-text">
                                <h3>Chat with Team</h3>
                                <p>Send DMs and create group chats directly within your API workspace.</p>
                            </div>
                        </div>
                        <div className="collab-feature-item">
                            <div className="collab-feature-icon">
                                <FiGitMerge className="icon" />
                            </div>
                            <div className="collab-feature-text">
                                <h3>Version History</h3>
                                <p>Track every edit effortlessly, and never lose a single API change.</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="collaboration-image">
                    <img src={collaborationImageUrl} alt="Team Collaboration" />
                </div>
            </section>

            {/* Knowledge Management Section with Image */}
            <section
                className={`knowledge-section ${getAnimationClass('knowledge')}`}
                ref={(el) => addSectionRef('knowledge', el)}
            >
                <div className="knowledge-image">
                    <img src={knowledgeImageUrl} alt="Knowledge Management" />
                </div>
                <div className="knowledge-content">
                    <h2>Knowledge at Your Fingertips</h2>
                    <p className="knowledge-description">
                        Pigeon offers a wide range of features to create and manage your API documentation. Our suite of collaborative editing tools boosts team efficiency.
                    </p>
                    <div className="document-features">
                        <div className="document-feature-item">
                            <FiFileText className="document-feature-icon" />
                            <p>Documents in Pigeon can be used for sharing API reference materials, collaborating on plans, and storing implementation details.</p>
                        </div>
                        <div className="document-feature-item">
                            <FiUsers className="document-feature-icon" />
                            <p>With real-time collaboration, remote teams can work together on API documentation with features like tagging users and linking to endpoints.</p>
                        </div>
                    </div>
                    <a href="/auth/google" className="knowledge-cta">
                        Start Documentation <FiArrowRight />
                    </a>
                </div>
            </section>

            {/* Features Section with hover effects */}
            <section
                className={`features-section-public ${getAnimationClass('features-public')}`}
                ref={(el) => addSectionRef('features-public', el)}
            >
                <h2>Key Features</h2>
                <div className="features-grid-public">
                    <div className="feature-card-public">
                        <div className="feature-icon-wrapper">
                            <FiZap className="feature-icon-public" />
                        </div>
                        <h3>Effortless Requesting</h3>
                        <p>Quickly create and send any type of HTTP request with an intuitive UI.</p>
                    </div>
                    <div className="feature-card-public">
                        <div className="feature-icon-wrapper">
                            <FiSearch className="feature-icon-public" />
                        </div>
                        <h3>Detailed Inspection</h3>
                        <p>Analyze responses, headers, cookies, and performance metrics with ease.</p>
                    </div>
                    <div className="feature-card-public">
                        <div className="feature-icon-wrapper">
                            <FiSave className="feature-icon-public" />
                        </div>
                        <h3>Save & Organize</h3>
                        <p>Save your requests, organize them into collections, and sync across devices.</p>
                    </div>
                </div>
            </section>

            {/* GitHub Integration Section with hover effects */}
            <section
                className={`github-section ${getAnimationClass('github')}`}
                ref={(el) => addSectionRef('github', el)}
            >
                <h2>Sync with GitHub. Both Ways.</h2>
                <p className="github-subtitle">Manage your API tasks efficiently with Pigeon's bidirectional GitHub synchronization. Use Pigeon as an advanced front-end for GitHub Issues.</p>

                <div className="github-features-grid">
                    <div className="github-feature-card">
                        <div className="github-feature-icon">
                            <FiGitMerge />
                        </div>
                        <h3>Two-way Synchronization</h3>
                        <p>Integrate your API tracker with GitHub to sync changes instantly.</p>
                    </div>
                    <div className="github-feature-card">
                        <div className="github-feature-icon">
                            <FiUsers />
                        </div>
                        <h3>Multiple Repositories</h3>
                        <p>Organize multiple projects for more effective planning and collaboration.</p>
                    </div>
                    <div className="github-feature-card">
                        <div className="github-feature-icon">
                            <FiGlobe />
                        </div>
                        <h3>Global Access</h3>
                        <p>Work with your team from anywhere in the world with seamless synchronization.</p>
                    </div>
                </div>
            </section>

            {/* Benefits Section - Enhanced with hover effects */}
            <section
                className={`benefits-section-public ${getAnimationClass('benefits')}`}
                ref={(el) => addSectionRef('benefits', el)}
            >
                <h2>Why Choose Pigeon?</h2>

                <div className="benefits-cards-container">
                    {/* Card 1 */}
                    <div className="benefit-card">
                        <div className="benefit-card-content">
                            <div className="benefit-card-front">
                                <div className="benefit-icon-wrapper">
                                    <FiCheckCircle className="benefit-card-icon" />
                                </div>
                                <h3>Intuitive Interface</h3>
                                <p>Easy to learn and use, even for beginners</p>
                            </div>
                            <div className="benefit-card-back" style={{ background: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)' }}>
                                <p>Our clean, modern interface helps you focus on what matters - testing your APIs without distractions.</p>
                                <a href="/auth/google" className="benefit-card-cta">
                                    Try it now <FiArrowRight />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Card 2 */}
                    <div className="benefit-card">
                        <div className="benefit-card-content">
                            <div className="benefit-card-front">
                                <div className="benefit-icon-wrapper">
                                    <FiShield className="benefit-card-icon" />
                                </div>
                                <h3>Core Functionality</h3>
                                <p>Everything you need for effective API testing</p>
                            </div>
                            <div className="benefit-card-back" style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }}>
                                <p>We focus on the essential features that developers need daily, without unnecessary complexity.</p>
                                <a href="/auth/google" className="benefit-card-cta">
                                    Get started <FiArrowRight />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Card 3 */}
                    <div className="benefit-card">
                        <div className="benefit-card-content">
                            <div className="benefit-card-front">
                                <div className="benefit-icon-wrapper">
                                    <FiLayers className="benefit-card-icon" />
                                </div>
                                <h3>Streamlined Workflow</h3>
                                <p>Save time and reduce errors</p>
                            </div>
                            <div className="benefit-card-back" style={{ background: 'linear-gradient(135deg, #f953c6 0%, #b91d73 100%)' }}>
                                <p>Pigeon helps you build a more efficient workflow with saved requests, collections, and quick responses.</p>
                                <a href="/auth/google" className="benefit-card-cta">
                                    Explore more <FiArrowRight />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Card 4 */}
                    <div className="benefit-card">
                        <div className="benefit-card-content">
                            <div className="benefit-card-front">
                                <div className="benefit-icon-wrapper">
                                    <FiCheckCircle className="benefit-card-icon" />
                                </div>
                                <h3>Free to Use</h3>
                                <p>Get started without any cost</p>
                            </div>
                            <div className="benefit-card-back" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
                                <p>Pigeon is 100% free to use with all core features available to everyone, no hidden limitations.</p>
                                <a href="/auth/google" className="benefit-card-cta">
                                    Sign up free <FiArrowRight />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Call to Action Section with hover effects */}
            <section
                className={`cta-section-public ${getAnimationClass('cta')}`}
                ref={(el) => addSectionRef('cta', el)}
            >
                <h2>Ready to Transform Your API Development?</h2>
                <p>Join thousands of developers building better APIs with Pigeon.</p>
                <div className="cta-buttons-container">
                    <a href="/auth/google" className="button primary-button cta-button-public">Try It Free</a>
                    <div className="social-links">
                        <a href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub"><FaGithub /></a>
                        <a href="https://slack.com" target="_blank" rel="noopener noreferrer" aria-label="Slack"><FaSlack /></a>
                        <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter"><FaTwitter /></a>
                        <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><FaLinkedin /></a>
                    </div>
                </div>
                <p className="made-with">Made with passion by the Pigeon team</p>
            </section>
        </div>
    );
};

export default PublicHome;
