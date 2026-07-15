// client/src/components/OnCall/OnCallTimeline.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './OnCallTimeline.css';

const OnCallTimeline = () => {
    const [schedules, setSchedules] = useState([]);
    const [selectedSchedule, setSelectedSchedule] = useState(null);
    const [timelineData, setTimelineData] = useState([]);
    const [viewMode, setViewMode] = useState('week'); // 'week', 'month'
    const [currentDate, setCurrentDate] = useState(new Date());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSchedules();
    }, []);

    useEffect(() => {
        if (selectedSchedule) {
            fetchTimeline();
        }
    }, [selectedSchedule, currentDate, viewMode]);

    const fetchSchedules = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/monitoring/on-call-schedules');
            setSchedules(response.data);
            if (response.data.length > 0) {
                setSelectedSchedule(response.data[0]._id);
            }
        } catch (error) {
            console.error('Error fetching schedules:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTimeline = async () => {
        try {
            const startDate = getStartDate();
            const endDate = getEndDate();

            const response = await axios.get(
                `/api/monitoring/on-call-schedules/${selectedSchedule}/timeline`,
                {
                    params: {
                        startDate: startDate.toISOString(),
                        endDate: endDate.toISOString()
                    }
                }
            );

            setTimelineData(response.data);
        } catch (error) {
            console.error('Error fetching timeline:', error);
        }
    };

    const getStartDate = () => {
        const date = new Date(currentDate);
        if (viewMode === 'week') {
            const day = date.getDay();
            const diff = date.getDate() - day;
            return new Date(date.setDate(diff));
        } else {
            return new Date(date.getFullYear(), date.getMonth(), 1);
        }
    };

    const getEndDate = () => {
        const startDate = getStartDate();
        if (viewMode === 'week') {
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 7);
            return endDate;
        } else {
            return new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
        }
    };

    const getDaysInView = () => {
        const days = [];
        const startDate = getStartDate();
        const endDate = getEndDate();

        for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
            days.push(new Date(d));
        }

        return days;
    };

    const navigatePrevious = () => {
        const newDate = new Date(currentDate);
        if (viewMode === 'week') {
            newDate.setDate(newDate.getDate() - 7);
        } else {
            newDate.setMonth(newDate.getMonth() - 1);
        }
        setCurrentDate(newDate);
    };

    const navigateNext = () => {
        const newDate = new Date(currentDate);
        if (viewMode === 'week') {
            newDate.setDate(newDate.getDate() + 7);
        } else {
            newDate.setMonth(newDate.getMonth() + 1);
        }
        setCurrentDate(newDate);
    };

    const navigateToday = () => {
        setCurrentDate(new Date());
    };

    const getOnCallForDate = (date) => {
        const dateStr = date.toISOString().split('T')[0];
        return timelineData.find(item =>
            item.date.startsWith(dateStr)
        );
    };

    const isToday = (date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const formatDateHeader = () => {
        if (viewMode === 'week') {
            const startDate = getStartDate();
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);

            return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        } else {
            return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
    };

    const selectedScheduleData = schedules.find(s => s._id === selectedSchedule);

    return (
        <div className="oncall-timeline">
            <div className="timeline-header">
                <h1 className="text-3xl font-bold text-gray-900">On-Call Timeline</h1>
                <div className="header-controls">
                    <select
                        value={selectedSchedule || ''}
                        onChange={(e) => setSelectedSchedule(e.target.value)}
                        className="schedule-select"
                    >
                        {schedules.map(schedule => (
                            <option key={schedule._id} value={schedule._id}>
                                {schedule.name}
                            </option>
                        ))}
                    </select>
                    <div className="view-mode-toggle">
                        <button
                            onClick={() => setViewMode('week')}
                            className={viewMode === 'week' ? 'active' : ''}
                        >
                            Week
                        </button>
                        <button
                            onClick={() => setViewMode('month')}
                            className={viewMode === 'month' ? 'active' : ''}
                        >
                            Month
                        </button>
                    </div>
                </div>
            </div>

            {selectedScheduleData && (
                <div className="schedule-info">
                    <div className="info-item">
                        <span className="info-label">Rotation:</span>
                        <span className="info-value">
                            {selectedScheduleData.rotation.type} ({selectedScheduleData.rotation.frequency}x)
                        </span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">Participants:</span>
                        <span className="info-value">
                            {selectedScheduleData.rotation.participants.length}
                        </span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">Timezone:</span>
                        <span className="info-value">{selectedScheduleData.timezone}</span>
                    </div>
                </div>
            )}

            <div className="timeline-navigation">
                <button onClick={navigatePrevious} className="nav-button">
                    ← Previous
                </button>
                <div className="current-period">
                    {formatDateHeader()}
                </div>
                <button onClick={navigateToday} className="nav-button">
                    Today
                </button>
                <button onClick={navigateNext} className="nav-button">
                    Next →
                </button>
            </div>

            {loading ? (
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading timeline...</p>
                </div>
            ) : (
                <div className={`timeline-grid ${viewMode}`}>
                    {getDaysInView().map((date, index) => {
                        const onCallData = getOnCallForDate(date);
                        const isTodayDate = isToday(date);

                        return (
                            <div
                                key={index}
                                className={`timeline-day ${isTodayDate ? 'today' : ''}`}
                            >
                                <div className="day-header">
                                    <div className="day-name">
                                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                                    </div>
                                    <div className={`day-number ${isTodayDate ? 'today-number' : ''}`}>
                                        {date.getDate()}
                                    </div>
                                </div>
                                <div className="day-content">
                                    {onCallData ? (
                                        <>
                                            <div className="oncall-person">
                                                <div className="person-avatar">
                                                    {onCallData.user?.name?.charAt(0) || '?'}
                                                </div>
                                                <div className="person-info">
                                                    <div className="person-name">
                                                        {onCallData.user?.name || 'Unknown'}
                                                    </div>
                                                    {onCallData.isOverride && (
                                                        <div className="override-indicator">
                                                            Override
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {onCallData.coverageWindow && (
                                                <div className="coverage-time">
                                                    {onCallData.coverageWindow.startTime} - {onCallData.coverageWindow.endTime}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="no-coverage">
                                            No coverage
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Legend */}
            <div className="timeline-legend">
                <h3 className="legend-title">Legend</h3>
                <div className="legend-items">
                    <div className="legend-item">
                        <div className="legend-indicator today-indicator"></div>
                        <span>Today</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-indicator regular-indicator"></div>
                        <span>Regular Rotation</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-indicator override-indicator-legend"></div>
                        <span>Override</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OnCallTimeline;
