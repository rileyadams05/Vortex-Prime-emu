import React, { useState } from 'react';
import {
  ChevronLeft, Store, Download, Upload, Globe, Search,
  Star, Eye, Heart, Clock, Filter, CheckCircle, X, User,
  Sparkles, Flame, Award
} from 'lucide-react';
import playSound from '../utils/soundManager';
import '../styles/Marketplace.css';

/* No dashboards yet — the store populates when creators submit real ones */
const COMMUNITY_DASHBOARDS = [];

const SORT_OPTIONS = ['Most Popular', 'Trending', 'Newest', 'Top Rated'];
const TAG_FILTERS = ['All', 'Featured'];

function formatNumber(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

/* ─── Browse Tab ─────────────────────────────────────────────────────── */
const BrowseTab = () => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('Most Popular');
  const [activeTag, setActiveTag] = useState('All');
  const [downloading, setDownloading] = useState(null);
  const [downloaded, setDownloaded] = useState([]);
  const [liked, setLiked] = useState([]);
  const [selectedDash, setSelectedDash] = useState(null);

  const filtered = COMMUNITY_DASHBOARDS.filter(d => {
    const matchesSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.author.toLowerCase().includes(search.toLowerCase());
    const matchesTag = activeTag === 'All' || (activeTag === 'Featured' ? d.featured : d.tags.includes(activeTag));
    return matchesSearch && matchesTag;
  }).sort((a, b) => {
    if (sortBy === 'Most Popular') return b.downloads - a.downloads;
    if (sortBy === 'Trending') return (b.trending ? 1 : 0) - (a.trending ? 1 : 0);
    if (sortBy === 'Top Rated') return b.rating - a.rating;
    return 0;
  });

  const handleDownload = (d) => {
    if (downloaded.includes(d.id)) return;
    playSound('select');
    setDownloading(d.id);
    setTimeout(() => {
      setDownloading(null);
      setDownloaded(prev => [...prev, d.id]);
    }, 1800);
  };

  const handleLike = (id) => {
    playSound('select');
    setLiked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="mp-browse">
      {/* Search + Sort Bar */}
      <div className="mp-search-bar">
        <div className="mp-search-input-wrap">
          <Search size={16} />
          <input
            className="mp-search-input"
            placeholder="Search dashboards, creators..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="store-search-input"
          />
          {search && (
            <button className="mp-search-clear" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>
        <div className="mp-sort-wrap">
          <Filter size={14} />
          <select className="mp-sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            {SORT_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {/* Tag Filters */}
      <div className="mp-tag-bar">
        {TAG_FILTERS.map(tag => (
          <button
            key={tag}
            className={`mp-tag-btn ${activeTag === tag ? 'active' : ''}`}
            onClick={() => { playSound('focus'); setActiveTag(tag); }}
          >
            {tag === 'Featured' && <Sparkles size={11} />}
            {tag}
          </button>
        ))}
      </div>

      {/* Stats Banner */}
      <div className="mp-stats-banner">
        <div className="mp-stat"><Flame size={14} /><span>{COMMUNITY_DASHBOARDS.length} Dashboards</span></div>
        <div className="mp-stat"><Award size={14} /><span>All Free</span></div>
      </div>

      {/* Grid */}
      <div className="mp-grid" data-testid="store-grid">
        {COMMUNITY_DASHBOARDS.length === 0 ? (
          <div className="mp-empty">
            <Globe size={40} />
            <p>No dashboards yet.</p>
            <p style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: 4 }}>Be the first to upload one!</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mp-empty">
            <Globe size={40} />
            <p>No dashboards match your search.</p>
          </div>
        ) : filtered.map(d => (
          <div
            key={d.id}
            className={`mp-card ${downloaded.includes(d.id) ? 'mp-card-owned' : ''}`}
            data-testid={`store-card-${d.id}`}
          >
            {/* Preview */}
            <div className="mp-card-preview" style={{ background: d.preview }}>
              <div className="mp-card-preview-overlay" style={{ '--accent': d.accent }}>
                <span className="mp-card-preview-icon">{d.authorAvatar}</span>
              </div>
              {d.featured && <span className="mp-badge featured"><Sparkles size={10} /> Featured</span>}
              {d.trending && <span className="mp-badge trending"><Flame size={10} /> Trending</span>}
              {downloaded.includes(d.id) && <span className="mp-badge owned"><CheckCircle size={10} /> Installed</span>}
            </div>

            {/* Info */}
            <div className="mp-card-body">
              <div className="mp-card-top">
                <h3 className="mp-card-name">{d.name}</h3>
                <div className="mp-card-rating">
                  <Star size={11} fill="#ffd700" color="#ffd700" />
                  <span>{d.rating}</span>
                </div>
              </div>
              <p className="mp-card-author">by {d.author} · v{d.version}</p>
              <p className="mp-card-desc">{d.description}</p>

              <div className="mp-card-tags">
                {d.tags.map(t => <span key={t} className="mp-card-tag" style={{ borderColor: d.accent + '44', color: d.accent }}>{t}</span>)}
              </div>

              <div className="mp-card-meta">
                <span><Download size={11} /> {formatNumber(d.downloads)}</span>
                <span><Eye size={11} /> {formatNumber(d.views)}</span>
                <span><Clock size={11} /> {d.updated}</span>
                <span>{d.size}</span>
              </div>

              <div className="mp-card-actions">
                <button
                  className={`mp-like-btn ${liked.includes(d.id) ? 'liked' : ''}`}
                  onClick={() => handleLike(d.id)}
                  title="Like"
                >
                  <Heart size={14} fill={liked.includes(d.id) ? 'currentColor' : 'none'} />
                  {formatNumber(d.likes + (liked.includes(d.id) ? 1 : 0))}
                </button>
                <button
                  className={`mp-details-btn`}
                  onClick={() => { playSound('select'); setSelectedDash(selectedDash?.id === d.id ? null : d); }}
                >
                  <Eye size={13} /> Preview
                </button>
                <button
                  className={`mp-download-btn ${downloaded.includes(d.id) ? 'installed' : ''} ${downloading === d.id ? 'loading' : ''}`}
                  data-testid={`download-btn-${d.id}`}
                  onClick={() => handleDownload(d)}
                  disabled={downloaded.includes(d.id) || downloading === d.id}
                >
                  {downloading === d.id
                    ? <><span className="mp-spin" /> Installing…</>
                    : downloaded.includes(d.id)
                      ? <><CheckCircle size={13} /> Installed</>
                      : <><Download size={13} /> Install</>
                  }
                </button>
              </div>

              {/* Expanded Preview */}
              {selectedDash?.id === d.id && (
                <div className="mp-expanded-preview" style={{ '--accent': d.accent }}>
                  <div className="mp-expanded-screen" style={{ background: d.preview }}>
                    <div className="mp-expanded-mock">
                      <div className="mp-mock-header" style={{ background: d.accent + '33' }}><span style={{ color: d.accent }}>{d.name}</span></div>
                      <div className="mp-mock-tiles">
                        {[...Array(6)].map((_, i) => (
                          <div key={i} className="mp-mock-tile" style={{ background: d.accent + '18', border: `1px solid ${d.accent}33` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="mp-expanded-desc">{d.description}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Upload Tab ─────────────────────────────────────────────────────── */
const UploadTab = () => {
  const [form, setForm] = useState({
    name: '',
    author: '',
    description: '',
    tags: '',
    version: '1.0.0',
  });
  const [submitted, setSubmitted] = useState(false);
  const [file, setFile] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.author || !form.description) return;
    playSound('select');
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="mp-upload-success">
        <div className="mp-upload-success-icon">
          <CheckCircle size={48} />
        </div>
        <h2>Dashboard Submitted!</h2>
        <p>Your dashboard <strong>"{form.name}"</strong> has been submitted for community review. It will appear in the store once approved.</p>
        <button className="mp-upload-again-btn" onClick={() => { setSubmitted(false); setForm({ name: '', author: '', description: '', tags: '', version: '1.0.0' }); setFile(null); }}>
          Upload Another
        </button>
      </div>
    );
  }

  return (
    <div className="mp-upload">
      <div className="mp-upload-hero">
        <Upload size={28} />
        <div>
          <h2>Share Your Dashboard</h2>
          <p>Upload your custom Vortex Prime dashboard for the community to enjoy</p>
        </div>
      </div>

      <form className="mp-upload-form" onSubmit={handleSubmit} data-testid="upload-form">
        <div className="mp-form-row">
          <div className="mp-form-group">
            <label>Dashboard Name <span className="mp-required">*</span></label>
            <input
              className="mp-input"
              placeholder="e.g. My Awesome Dashboard"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              data-testid="upload-name"
            />
          </div>
          <div className="mp-form-group">
            <label>Your Creator Name <span className="mp-required">*</span></label>
            <input
              className="mp-input"
              placeholder="e.g. YourGamertag"
              value={form.author}
              onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
              data-testid="upload-author"
            />
          </div>
        </div>

        <div className="mp-form-group">
          <label>Description <span className="mp-required">*</span></label>
          <textarea
            className="mp-input mp-textarea"
            placeholder="Describe your dashboard theme, features, and what makes it unique..."
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={4}
            data-testid="upload-desc"
          />
        </div>

        <div className="mp-form-row">
          <div className="mp-form-group">
            <label>Tags</label>
            <input
              className="mp-input"
              placeholder="e.g. Dark, Sci-Fi, Neon (comma separated)"
              value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              data-testid="upload-tags"
            />
          </div>
          <div className="mp-form-group">
            <label>Version</label>
            <input
              className="mp-input"
              placeholder="e.g. 1.0.0"
              value={form.version}
              onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
              data-testid="upload-version"
            />
          </div>
        </div>

        {/* File Drop Area */}
        <div className="mp-form-group">
          <label>Dashboard File (.zip)</label>
          <div
            className={`mp-file-drop ${file ? 'has-file' : ''}`}
            onClick={() => document.getElementById('mp-file-input').click()}
            data-testid="upload-file-area"
          >
            <input
              id="mp-file-input"
              type="file"
              accept=".zip"
              style={{ display: 'none' }}
              onChange={e => setFile(e.target.files[0])}
            />
            {file ? (
              <>
                <CheckCircle size={24} style={{ color: '#90c31d' }} />
                <span className="mp-file-name">{file.name}</span>
                <button type="button" className="mp-file-remove" onClick={e => { e.stopPropagation(); setFile(null); }}>
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <Upload size={24} style={{ color: 'rgba(255,255,255,0.4)' }} />
                <span>Drop your .zip file here or <u>click to browse</u></span>
                <span className="mp-file-hint">Max 50 MB</span>
              </>
            )}
          </div>
        </div>

        {/* Guidelines */}
        <div className="mp-guidelines">
          <h4>📋 Submission Guidelines</h4>
          <ul>
            <li>Dashboard must be your original work or have proper credits</li>
            <li>No inappropriate content, copyrighted brand logos without permission</li>
            <li>Package as .zip including a manifest.json and preview screenshot</li>
            <li>Review process typically takes 24–48 hours</li>
          </ul>
        </div>

        <button
          type="submit"
          className="mp-submit-btn"
          data-testid="upload-submit"
          disabled={!form.name || !form.author || !form.description}
        >
          <Upload size={16} />
          Submit for Review
        </button>
      </form>
    </div>
  );
};

/* ─── Main Marketplace Component ─────────────────────────────────────── */
const Marketplace = ({ onBack, defaultTab = 'browse' }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <div className="marketplace-view" data-testid="marketplace-view">
      {/* Header */}
      <div className="market-header">
        <button className="back-btn" data-testid="marketplace-back-btn" onClick={() => { playSound('back'); onBack(); }}>
          <ChevronLeft size={20} /> Back
        </button>
        <Store size={18} style={{ color: '#90c31d' }} />
        <h1 className="market-title">VORTEX STORE</h1>
        <div className="market-tabs">
          <button
            className={`market-tab ${activeTab === 'browse' ? 'active' : ''}`}
            data-testid="tab-browse"
            onClick={() => { playSound('focus'); setActiveTab('browse'); }}
          >
            <Globe size={14} /> Browse
          </button>
          <button
            className={`market-tab ${activeTab === 'upload' ? 'active' : ''}`}
            data-testid="tab-upload"
            onClick={() => { playSound('focus'); setActiveTab('upload'); }}
          >
            <Upload size={14} /> Upload
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="market-content">
        {activeTab === 'browse' ? <BrowseTab /> : <UploadTab />}
      </div>
    </div>
  );
};

export default Marketplace;
