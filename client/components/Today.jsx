/* global window */
import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import { graphql, compose } from 'react-apollo';

import * as queries from '../queries.graphql';
import AlertModal from './ui/modals/AlertModal';
import ConfirmModal from './ui/modals/ConfirmModal';
import StaticTime from './today/StaticTime';
import PageLoading from './genericPages/PageLoading';
import strings from '../../shared/strings';
import {
	setTodayStorage,
	getTodayStorage,
	submitToServer
} from '../utils';
import { timeIsValid } from '../../shared/utils';

import '../styles/today.styl';

const MODAL_ALERT = 'alert';
const MODAL_CONFIRM = 'confirm';


const isEmptyObject = obj => (
	Object.keys(obj).length === 0
);

const getNextEmptyObjectOnArray = arr => (
	arr.findIndex((element => (
		isEmptyObject(element) || !('hours' in element) || !('minutes' in element)
	)))
);

const timeSetIsValid = (times) => {
	let comparisonTerm = 0;
	const isSequentialTime = (time) => {
		if (isEmptyObject(time)) {
			return true;
		}
		if (time && timeIsValid(time)) {
			const date = new Date(2017, 0, 1, time.hours, time.minutes, 0, 0);
			const isLaterThanComparison = date > comparisonTerm;
			comparisonTerm = Number(date);
			return isLaterThanComparison;
		}
		return false;
	};
	return times.every(isSequentialTime);
};

const allTheTimesAreFilled = times => (
	getNextEmptyObjectOnArray(times) === -1
);

const goBack = () => {
	window.history.back();
};

class Today extends React.Component {
	constructor() {
		super();
		this.state = {
			storedTimes: [{}, {}, {}, {}],
			sentToday: false,
			showModal: null,
			alertInfo: {}
		};
		this.onMark = this.onMark.bind(this);
		this._avoidDoubleClick = this._avoidDoubleClick.bind(this);
		this._getButtonString = this._getButtonString.bind(this);
		this._getNextTimeEntryPoint = this._getNextTimeEntryPoint.bind(this);
		this._shouldButtonBeAvailable = this._shouldButtonBeAvailable.bind(this);
		this._onConfirmSubmit = this._onConfirmSubmit.bind(this);
		this._hideAlert = this._hideAlert.bind(this);
		this._checkEnteredValues = this._checkEnteredValues.bind(this);
	}

	componentDidMount() {
		this._checkEnteredValues(this.props.dayEntryQuery);
	}

	componentWillReceiveProps(nextProps) {
		// If finished (was loading and stoped) loading from server and no erros fill the state
		const {
			loading,
			error
		} = nextProps.dayEntryQuery;

		if (this.props.dayEntryQuery.loading && !loading && !error) {
			this._checkEnteredValues(nextProps.dayEntryQuery);
		}
	}

	onMark(event) {
		event.preventDefault();

		const momentTime = { hours: moment().hours(), minutes: moment().minutes() };
		const index = this._getNextTimeEntryPoint();

		if (this._avoidDoubleClick(momentTime, index)) {
			const { storedTimes, sentToday } = this.state;
			storedTimes[index] = momentTime;
			if (timeSetIsValid(storedTimes)) {
				setTodayStorage({ storedTimes, sentToday });
				this.setState((prevState) => {
					const newState = { ...prevState, storedTimes, sentToday };
					if (index === 3) {
						const date = moment();
						submitToServer(date, storedTimes, this.props.addTimeEntry);
					}
					return newState;
				});
			} else {
				this.setState({
					alertInfo: {
						content: strings.invalidAddTime,
						onClose: this._hideAlert
					},
					showModal: MODAL_ALERT
				});
			}
		} else {
			// Raise clicked on the same minute
		}
	}

	async _onConfirmSubmit() {
		const { storedTimes } = getTodayStorage();
		const date = moment();
		const ret = await submitToServer(date, storedTimes, this.props.addTimeEntry);
		if (ret.successMessage) {
			this.setState({ storedTimes, sentToday: true });
			setTodayStorage({ storedTimes, sentToday: true });
		} else {
			// Was not able to send to server even if user said to send
			goBack();
		}
	}

	_checkEnteredValues(dayEntryQuery) {
		const {	loading, dayEntry } = dayEntryQuery;

		if (loading) {
			return;
		}

		const { timeEntry } = dayEntry;
		if (timeEntry) {
			const startTime = moment(timeEntry.startTime, 'H:mm');
			const startBreakTime = moment(timeEntry.startBreakTime, 'H:mm');
			const endBreakTime = moment(timeEntry.endBreakTime, 'H:mm');
			const endTime = moment(timeEntry.endTime, 'H:mm');

			// If data is on server
			if (startTime.isValid() &&
				startBreakTime.isValid() &&
				endBreakTime.isValid() &&
				endTime.isValid()
			) {
				const storedTimes = [
					{
						hours: startTime.hours(),
						minutes: startTime.minutes()
					},
					{
						hours: startBreakTime.hours(),
						minutes: startBreakTime.minutes()
					},
					{
						hours: endBreakTime.hours(),
						minutes: endBreakTime.minutes()
					},
					{
						hours: endTime.hours(),
						minutes: endTime.minutes()
					}
				];
				setTodayStorage({
					storedTimes,
					sentToday: true
				});
				this.setState({
					storedTimes,
					sentToday: true
				});
			} else {
				const { sentToday, storedTimes } = getTodayStorage();
				if (!sentToday) {
					if (allTheTimesAreFilled(storedTimes)) {
						if (timeSetIsValid(storedTimes)) {
							this.setState({
								showModal: MODAL_CONFIRM
							});
						} else {
							this.setState({
								alertInfo: {
									content: strings.invalidTime,
									onClose: () => goBack()
								},
								showModal: MODAL_ALERT
							});
						}
					}
				}
				this.setState({ storedTimes, sentToday });
			}
		}
	}

	_getTime(index) {
		const storedTimesLength = this._getNextTimeEntryPoint();
		if (storedTimesLength !== -1 && storedTimesLength < index) {
			return { hours: 0, minutes: 0 };
		}
		return this.state.storedTimes[index];
	}

	_getButtonString() {
		const len = this._getNextTimeEntryPoint();
		const complementString = len === -1 ? strings.send : strings.times[len].label;
		return (
			<span>
				{strings.markNow} <strong>{complementString}</strong>
			</span>
		);
	}

	_getNextTimeEntryPoint() {
		const storedTimes = [...this.state.storedTimes];
		return getNextEmptyObjectOnArray(storedTimes);
	}

	_avoidDoubleClick(time, index) {
		const storedTimes = [...this.state.storedTimes];
		if (index === 0) {
			return true;
		}
		const { hours, minutes } = storedTimes[index - 1];
		return (time.hours !== hours || time.minutes !== minutes);
	}

	_shouldButtonBeAvailable() {
		return this._getNextTimeEntryPoint() !== -1;
	}

	_hideAlert() {
		this.setState({
			showModal: null
		});
	}

	render() {
		const { dayEntryQuery } = this.props;
		return (
			<div className="page-wrapper">
				<PageLoading
					active={dayEntryQuery.loading}
				/>
				<form onSubmit={e => this.onMark(e)}>
					<h2 className="current-date">
						{strings.todayDate}:{' '}
						<strong>{moment().format('L')}</strong>
					</h2>
					<div className="column">
						<div className="time-show-content">
							{[0, 1, 2, 3].map(index => (
								<StaticTime
									key={index}
									time={this._getTime(index)}
									label={strings.times[index].label}
									emphasis={index < this.state.storedTimes.length}
								/>
							))}
						</div>
					</div>
					<div className="column">
						<div className="time-management-content">
							{this._shouldButtonBeAvailable() ?
								<button type="submit" className="send send-today">
									{this._getButtonString()}
								</button>
								:
								<span className="time-sent">{strings.timeSentToday}</span>
							}
						</div>
					</div>
				</form>
				<AlertModal
					active={this.state.showModal === MODAL_ALERT}
					content={this.state.alertInfo.content}
					onClose={this.state.alertInfo.onClose}
				/>
				<ConfirmModal
					active={this.state.showModal === MODAL_CONFIRM}
					content={strings.confirmSave}
					onCancel={() => goBack()}
					onConfirm={this._onConfirmSubmit}
				/>
			</div>
		);
	}
}

export default compose(
	graphql(queries.addTimeEntry, {
		name: 'addTimeEntry'
	}),
	graphql(queries.dayEntry, {
		name: 'dayEntryQuery',
		options: { variables: { date: moment().format('YYYY-MM-DD') } }
	})
)(Today);

Today.propTypes = {
	addTimeEntry: PropTypes.func.isRequired,
	dayEntryQuery: PropTypes.object.isRequired
};

Today.contextTypes = {
	router: PropTypes.object
};
