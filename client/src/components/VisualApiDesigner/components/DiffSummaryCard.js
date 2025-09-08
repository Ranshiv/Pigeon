import React from 'react';
import {
    FiAlertTriangle,
    FiCheckCircle,
    FiInfo,
    FiTrendingUp,
    FiShield
} from 'react-icons/fi';
import './DiffSummaryCard.css';

const DiffSummaryCard = ({
    comparisonResult,
    version1,
    version2,
    // Legacy props for backward compatibility
    totalChanges: legacyTotalChanges,
    breakingChanges: legacyBreakingChanges,
    nonBreakingChanges: legacyNonBreakingChanges,
    compatibilityScore: legacyCompatibilityScore
}) => {
    // Extract data from comparisonResult if available, otherwise use legacy props
    const changes = comparisonResult?.changes || [];
    const totalChanges = legacyTotalChanges ?? changes.length;
    const breakingChanges = legacyBreakingChanges ?? changes.filter(change => change.breaking).length;
    const nonBreakingChanges = legacyNonBreakingChanges ?? changes.filter(change => !change.breaking).length;
    const compatibilityScore = legacyCompatibilityScore ?? (comparisonResult?.compatibilityScore ||
        (breakingChanges === 0 ? 100 : Math.max(0, 100 - (breakingChanges * 20))));

    // Check if this is an "empty" comparison (identical versions)
    const isEmptyComparison = totalChanges === 0 && breakingChanges === 0 && nonBreakingChanges === 0;

    const getCompatibilityLevel = (score) => {
        if (score >= 90) return { level: 'excellent', color: 'green', icon: FiShield };
        if (score >= 70) return { level: 'good', color: 'blue', icon: FiCheckCircle };
        if (score >= 50) return { level: 'moderate', color: 'orange', icon: FiInfo };
        return { level: 'poor', color: 'red', icon: FiAlertTriangle };
    };

    const compatibility = getCompatibilityLevel(compatibilityScore || 0);
    const CompatibilityIcon = compatibility.icon;

    // Show special message for identical versions
    if (isEmptyComparison) {
        return (
            <div className="diff-summary-cards">
                <div className="empty-comparison-state">
                    <div className="empty-comparison-icon">
                        <FiCheckCircle className="success-icon" />
                    </div>
                    <h3>Versions Are Identical</h3>
                    <p>
                        The selected versions have no differences. They contain the same API specification.
                    </p>
                    <div className="identical-versions-info">
                        <div className="version-detail">
                            <strong>From:</strong> {version1?.name || 'Version 1'}
                        </div>
                        <div className="version-detail">
                            <strong>To:</strong> {version2?.name || 'Version 2'}
                        </div>
                    </div>
                    <div className="compatibility-status">
                        <FiShield className="shield-icon" />
                        <span>100% Compatible - No Breaking Changes</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="diff-summary-cards">
            {/* Total Changes Card */}
            <div className="summary-card total-changes">
                <div className="card-header">
                    <div className="card-icon">
                        <FiTrendingUp />
                    </div>
                    <div className="card-content">
                        <h3>Total Changes</h3>
                        <div className="card-value">{totalChanges}</div>
                    </div>
                </div>
                <div className="card-footer">
                    <span className="card-subtitle">Detected differences</span>
                </div>
            </div>

            {/* Breaking Changes Card */}
            <div className="summary-card breaking-changes">
                <div className="card-header">
                    <div className="card-icon breaking">
                        <FiAlertTriangle />
                    </div>
                    <div className="card-content">
                        <h3>Breaking Changes</h3>
                        <div className="card-value">{breakingChanges}</div>
                    </div>
                </div>
                <div className="card-footer">
                    <span className="card-subtitle">
                        {breakingChanges === 0 ? 'No breaking changes' : 'Requires attention'}
                    </span>
                </div>
            </div>

            {/* Non-breaking Changes Card */}
            <div className="summary-card non-breaking-changes">
                <div className="card-header">
                    <div className="card-icon safe">
                        <FiCheckCircle />
                    </div>
                    <div className="card-content">
                        <h3>Safe Changes</h3>
                        <div className="card-value">{nonBreakingChanges}</div>
                    </div>
                </div>
                <div className="card-footer">
                    <span className="card-subtitle">Backward compatible</span>
                </div>
            </div>

            {/* Compatibility Score Card */}
            <div className={`summary-card compatibility-score ${compatibility.level}`}>
                <div className="card-header">
                    <div className={`card-icon ${compatibility.color}`}>
                        <CompatibilityIcon />
                    </div>
                    <div className="card-content">
                        <h3>Compatibility</h3>
                        <div className="card-value">
                            {compatibilityScore ? `${Math.round(compatibilityScore)}%` : 'N/A'}
                        </div>
                    </div>
                </div>
                <div className="card-footer">
                    <span className="card-subtitle">
                        {compatibility.level.charAt(0).toUpperCase() + compatibility.level.slice(1)} compatibility
                    </span>
                </div>
            </div>
        </div>
    );
};

export default DiffSummaryCard;
