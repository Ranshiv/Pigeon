// client/src/components/common/TabBar/TabBar.js
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { FiMoreHorizontal } from 'react-icons/fi';
import './TabBar.css';

const TabBar = ({ tabs = [], activeId, onChange, ariaLabel = 'Tabs' }) => {
    const containerRef = useRef(null);
    const [visibleCount, setVisibleCount] = useState(tabs.length);
    const [menuOpen, setMenuOpen] = useState(false);

    // Measure available width and decide how many tabs fit.
    const measure = () => {
        const container = containerRef.current;
        if (!container) return;
        const available = container.clientWidth;
        // Reserve 42px for the overflow button when needed.
        let reserved = 0;
        const tabNodes = container.querySelectorAll('.tb__tab--measure');
        let totalWidth = 0;
        let count = 0;
        for (let i = 0; i < tabNodes.length; i += 1) {
            const w = tabNodes[i].getBoundingClientRect().width;
            totalWidth += w;
            if (totalWidth + reserved > available) {
                // Active tab must remain visible.
                if (tabs[i].id === activeId && count > 0) {
                    count -= 1;
                }
                break;
            }
            count += 1;
            if (count < tabs.length) reserved = 42;
        }
        setVisibleCount(count);
    };

    useLayoutEffect(measure, [tabs.length]);
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(measure);
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const selectedIndex = tabs.findIndex((t) => t.id === activeId);
    const activeInOverflow = selectedIndex >= visibleCount;
    // If active is overflowed, show it as the last visible tab.
    const visibleEnd = activeInOverflow ? Math.min(selectedIndex + 1, tabs.length) : visibleCount;
    const visibleTabs = tabs.slice(0, visibleEnd);
    const overflowTabs = tabs.slice(visibleEnd);

    const onSelect = (id) => {
        setMenuOpen(false);
        onChange && onChange(id);
    };

    const focusTab = (index) => {
        const next = tabs[index];
        if (!next) return;
        onSelect(next.id);
        const el = containerRef.current && containerRef.current.querySelectorAll('[role="tab"]')[index];
        if (el) el.focus();
    };

    const onKeyDown = (e, index) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            focusTab(Math.min(index + 1, tabs.length - 1));
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            focusTab(Math.max(index - 1, 0));
        } else if (e.key === 'Home') {
            e.preventDefault();
            focusTab(0);
        } else if (e.key === 'End') {
            e.preventDefault();
            focusTab(tabs.length - 1);
        }
    };

    return (
        <div className="tb" role="tablist" aria-label={ariaLabel} ref={containerRef}>
            {/* hidden measure row to calculate every tab's natural width */}
            <div className="tb__measure" aria-hidden="true">
                {tabs.map((t) => (
                    <div key={`m-${t.id}`} className="tb__tab--measure">
                        {t.icon && <span className="tb__icon">{t.icon}</span>}
                        <span className="tb__label">{t.label}</span>
                        {t.badge != null && <span className="tb__badge">{t.badge}</span>}
                    </div>
                ))}
            </div>

            {visibleTabs.map((t, i) => {
                const selected = t.id === activeId;
                return (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        tabIndex={selected ? 0 : -1}
                        className={`tb__tab ${selected ? 'tb__tab--active' : ''}`}
                        onClick={() => onSelect(t.id)}
                        onKeyDown={(e) => onKeyDown(e, i)}
                    >
                        {t.icon && <span className="tb__icon">{t.icon}</span>}
                        <span className="tb__label">{t.label}</span>
                        {t.badge != null && <span className="tb__badge">{t.badge}</span>}
                    </button>
                );
            })}

            {overflowTabs.length > 0 && (
                <div className="tb__overflow">
                    <button
                        type="button"
                        className={`tb__more ${menuOpen ? 'tb__more--open' : ''}`}
                        aria-haspopup="true"
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen((o) => !o)}
                        title="More tabs"
                    >
                        <FiMoreHorizontal />
                    </button>
                    {menuOpen && (
                        <div className="tb__menu tb__menu--open" role="menu">
                            {overflowTabs.map((t) => {
                                const selected = t.id === activeId;
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        role="menuitem"
                                        className={`tb__menu-item ${selected ? 'tb__menu-item--active' : ''}`}
                                        onClick={() => onSelect(t.id)}
                                    >
                                        {t.icon && <span className="tb__icon">{t.icon}</span>}
                                        <span className="tb__label">{t.label}</span>
                                        {t.badge != null && <span className="tb__badge">{t.badge}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TabBar;
