import React from 'react';
import PropTypes from 'prop-types';

import TimeField from './TimeField';

import './TimeGroup.styl';

const getClassName = props =>
	`time-group ${props.emphasis ? 'emphasis' : ''}`;

export default class TimeGroup extends React.Component {
	constructor(props) {
		super(props);

		this.randomId = String(Math.random());

		this.onChangeTime = this.onChangeTime.bind(this);
	}

	onChangeTime(mode) {
		return (dummy, suggestion) => {
			const newtime = { ...this.props.time };
			newtime[mode] = suggestion;
			this.props.onSet(newtime.hours, newtime.minutes);
		};
	}

	render() {
		const {
			referenceHour,
			time,
			label,
			hidden,
			disabled
		} = this.props;

		if (hidden) {
			return null;
		}
		return (
			<div className={getClassName(this.props)}>
				<label htmlFor={`${this.randomId}_h`}>{label}</label>
				<TimeField
					mode="hours"
					value={time.hours}
					referenceHour={referenceHour}
					shouldHaveFocus={this.props.shouldHaveFocus === 'hours'}
					onChange={this.onChangeTime('hours')}
					onFocus={this.props.onFocus}
					tabIndex={this.props.tabIndexes}
					disabled={disabled}
					handleKeyPress={this.props.handleKeyPress}
				/>
				<span className="separator">:</span>
				<TimeField
					mode="minutes"
					value={time.minutes}
					shouldHaveFocus={this.props.shouldHaveFocus === 'minutes'}
					onChange={this.onChangeTime('minutes')}
					onFocus={this.props.onFocus}
					tabIndex={this.props.tabIndexes + 1}
					disabled={disabled}
					handleKeyPress={this.props.handleKeyPress}
				/>
			</div>
		);
	}
}

TimeGroup.propTypes = {
	onSet: PropTypes.func,
	referenceHour: PropTypes.number,
	time: PropTypes.object,
	label: PropTypes.string,
	shouldHaveFocus: PropTypes.oneOfType([
		PropTypes.oneOf(['hours', 'minutes']),
		PropTypes.bool
	]),
	onFocus: PropTypes.func.isRequired,
	tabIndexes: PropTypes.number,
	hidden: PropTypes.bool,
	disabled: PropTypes.bool,
	handleKeyPress: PropTypes.func
};

TimeGroup.defaultProps = {
	referenceHour: 9,
	label: '',
	shouldHaveFocus: false,
	time: { hours: 0, minutes: 0 },
	tabIndexes: 0,
	hidden: false,
	disabled: false,
	onSet: () => {},
	handleKeyPress: () => {}
};
