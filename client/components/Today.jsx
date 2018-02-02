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
import {
	isValidTimeObject,
	getNextEmptyObjectOnArray,
	timeSetIsValid,
	allTheTimesAreFilled,
	goBack
} from './today/utils';

const MODAL_ALERT = 'alert';
const MODAL_CONFIRM = 'confirm';

class Today extends React.Component {
	constructor() {
		super();
		this.state = {
			storedTimes: [{}, {}, {}, {}],
			sentToday: false,
			showModal: null,
			alertInfo: {},
			buttonDisabled: false
		};
		this.onMark = this.onMark.bind(this);
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
		const _this = this;
		setTimeout(() => {
			_this.setState({ buttonDisabled: false });
		}, 60000);
		this.setState({ buttonDisabled: true });

		const momentTime = { hours: moment().hours(), minutes: moment().minutes() };
		const index = this._getNextTimeEntryPoint();
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
		return (
			<span>
				{strings.markNow} <strong>{strings.times[len].label}</strong>
			</span>
		);
	}

	_getNextTimeEntryPoint() {
		const storedTimes = [...this.state.storedTimes];
		return getNextEmptyObjectOnArray(storedTimes);
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
				<h2 className="current-date">
					{strings.todayDate}:{' '}
					<strong>{moment().format('L')}</strong>
				</h2>
				<form onSubmit={e => this.onMark(e)} className="columns">
					<div className="column column-half">
						{[0, 1, 2, 3].map(index => (
							<StaticTime
								key={index}
								time={this._getTime(index)}
								label={strings.times[index].label}
								emphasis={isValidTimeObject(this.state.storedTimes[index])}
							/>
						))}
					</div>
					<div className="column column-half">
						{this._shouldButtonBeAvailable() ?
							<button
								type="submit"
								className="send send-today"
								disabled={this.state.buttonDisabled}
							>
								{this._getButtonString()}
							</button>
							:
							<span className="time-sent">{strings.timeSentToday}</span>
						}
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
