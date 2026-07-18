import React, { useRef, useEffect } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
);

const ChartRenderer = ({
    type,
    data,
    options = {},
    className = ''
}) => {
    const chartRef = useRef(null);

    useEffect(() => {
        // Cleanup function when component unmounts
        const currentChart = chartRef.current;
        return () => {
            if (currentChart && typeof currentChart.destroy === 'function') {
                currentChart.destroy();
            }
        };
    }, []);

    const defaultOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            title: {
                display: true,
                text: options.title || 'Chart',
                font: {
                    size: 16,
                    weight: 'bold'
                }
            },
            legend: {
                display: true,
                position: 'bottom'
            },
            tooltip: {
                enabled: true,
                mode: 'index',
                intersect: false,
            }
        },
        ...options
    };

    const chartProps = {
        ref: chartRef,
        data: data,
        options: defaultOptions
    };

    const renderChart = () => {
        switch (type.toLowerCase()) {
            case 'bar':
                return <Bar {...chartProps} />;
            case 'line':
                return <Line {...chartProps} />;
            case 'pie':
                return <Pie {...chartProps} />;
            case 'doughnut':
                return <Doughnut {...chartProps} />;
            default:
                return (
                    <div className="chart-error">
                        <p>Unsupported chart type: {type}</p>
                    </div>
                );
        }
    };

    return (
        <div className={`chart-container ${className}`}>
            {renderChart()}
        </div>
    );
};

export default ChartRenderer;
