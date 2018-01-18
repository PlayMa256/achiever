require('dotenv').config();
const rp = require('request-promise');
const cheerio = require('cheerio');
const moment = require('moment');
const jwt = require('jwt-simple');

const logger = require('../logger');
const {
	ACHIEVO_URL,
	extractError,
	getOptions,
	stringfyTime,
	activityToPayload,
	extractSelectOptions,
	workTimeFromHtml,
	breakTimeFromHtml,
	cookieJarFactory,
	thereIsSessionFrom,
	setSession,
	removeSession
} = require('./utils');

const jwtSecret = process.env.JWT_SECRET;

const authenticationSucceed = 'Your browser doesnt support frames, but this is required';

const commonPayload = (id, formKey, functionName) => ({
	form_key: formKey,
	person: id,
	init_userid: id,
	function: functionName
});

const getUserDetails = async (cookieJar) => {
	const options = getOptions('GET', `${ACHIEVO_URL}/dlabs/timereg/newhours_insert.php`, cookieJar);
	const formKeyHtml = await rp(options);

	const error = extractError(formKeyHtml);
	if (error) {
		throw error;
	}

	const $ = cheerio.load(formKeyHtml);
	const formKey = $('input[type="hidden"][name="form_key"]').val();
	const personId = $('input[type="hidden"][name="person"]').val();

	return {
		formKey,
		personId
	};
};

const authenticationFailedMessage = 'Authentication failed!';

const login = async (token) => {
	if (thereIsSessionFrom(token) > 0) {
		setSession(token);
		return token;
	}

	const cookieJar = cookieJarFactory(token);

	let options = getOptions('GET', `${ACHIEVO_URL}/index.php`, cookieJar);
	const response = await rp(options);

	if (!response || !response.includes(authenticationSucceed)) {
		const { user, password } = jwt.decode(token, jwtSecret);
		options = getOptions('POST', `${ACHIEVO_URL}/index.php`, cookieJar);
		options.formData = { auth_user: user, auth_pw: password };

		const loginResponseHtml = await rp(options);
		const error = extractError(loginResponseHtml);
		if (error ||
			!loginResponseHtml ||
			!loginResponseHtml.includes(authenticationSucceed)) {
			throw authenticationFailedMessage;
		}
	}

	logger.info('Authenticated!!!');

	setSession(token);

	return token;
};

const logout = async (token) => {
	if (removeSession(token) > 0) {
		return;
	}
	const cookieJar = cookieJarFactory(token);
	const options = getOptions('GET', `${ACHIEVO_URL}/index.php`, cookieJar);
	options.qs = {
		atklogout: 1
	};

	await rp(options);

	logger.info('Logged out!!!');
};

const phases = () => async (token) => {
	const cookieJar = cookieJarFactory(token);
	const { personId } = await getUserDetails(cookieJar);
	const options = getOptions('GET', `${ACHIEVO_URL}/dlabs/timereg/timereg_lib.php`, cookieJar);
	options.qs = {
		person: personId,
		init_userid: personId,
		function: 'proj_phase'
	};

	const responseHtml = await rp(options);

	return extractSelectOptions('proj_phase', responseHtml);
};

const activities = phase => async (token) => {
	const cookieJar = cookieJarFactory(token);
	const { personId } = await getUserDetails(cookieJar);
	const options = getOptions('GET', `${ACHIEVO_URL}/dlabs/timereg/timereg_lib.php`, cookieJar);
	options.qs = {
		person: personId,
		init_userid: personId,
		phase,
		function: 'proj_activity'
	};

	const responseHtml = await rp(options);

	return extractSelectOptions('proj_activity', responseHtml);
};

const userDetails = () => async (token) => {
	const cookieJar = cookieJarFactory(token);
	const { personId } = await getUserDetails(cookieJar);
	const options = getOptions('GET', `${ACHIEVO_URL}/dlabs/timereg/report.php`, cookieJar);
	options.qs = {
		init_userid: personId
	};

	const responseHtml = await rp(options);
	const error = extractError(responseHtml);
	if (error) {
		throw error;
	}

	const $ = cheerio.load(responseHtml);
	const name = $('h4').eq(0).text().trim();
	const dailyContractedHours = $('table tr td').eq(1).text();
	const balance = $('table tr td').eq(8).text();

	return {
		name,
		dailyContractedHours,
		balance
	};
};

const dailyEntries = date => async (token) => {
	const cookieJar = cookieJarFactory(token);
	const options = getOptions('GET', `${ACHIEVO_URL}/dlabs/timereg/newhours_list.php`, cookieJar);
	options.qs = { datei: date };

	const responseHtml = await rp(options);
	const $ = cheerio.load(responseHtml);
	const {
		workTimeId,
		startTime,
		phase,
		activity,
		total
	} = workTimeFromHtml($);
	const {
		breakTimeId,
		startBreakTime,
		endBreakTime,
		breakTimeDuration
	} = breakTimeFromHtml($);

	let endTime = '';

	const isValid = Boolean(startTime);

	if (isValid) {
		endTime = moment(startTime, 'hh:mm');
		const totalWorked = moment(total, 'hh:mm');
		const durantion = moment(breakTimeDuration, 'hh:mm');
		endTime.add({ hours: totalWorked.hours(), minutes: totalWorked.minutes() });
		endTime.add({ hours: durantion.hours(), minutes: durantion.minutes() });
		endTime = endTime.format('H:mm');
	}

	const timeEntry = {
		id: { workTimeId, breakTimeId },
		date,
		phase,
		activity,
		startTime: (isValid && startTime) || '',
		endTime: (isValid && endTime) || '',
		startBreakTime: (isValid && startBreakTime) || '',
		endBreakTime: (isValid && endBreakTime) || '',
		total: (isValid && total) || ''
	};

	return timeEntry;
};

const weekEntriesByDate = date => async (token) => {
	const refDate = moment(date);
	refDate.day(0);

	const totalWorkedTime = moment().startOf('year');

	const asyncRequests = [];
	for (let i = 0; i < 7; i += 1) {
		const currentDate = refDate.format('YYYY-MM-DD');
		asyncRequests.push(dailyEntries(currentDate)(token));
		refDate.add(1, 'days');
	}

	const timeEntries = await Promise.all(asyncRequests);

	timeEntries.forEach((entry) => {
		if (entry && entry.total) {
			const dailyTotal = moment(entry.total, 'hh:mm');

			totalWorkedTime.add(dailyTotal.hour(), 'hours');
			totalWorkedTime.add(dailyTotal.minute(), 'minutes');
		}
	});

	const totalHours = totalWorkedTime.diff(moment().startOf('year'), 'hours');
	const totalMinutes = totalWorkedTime.diff(moment().startOf('year'), 'minutes') - (totalHours * 60);

	return {
		timeEntries,
		total: stringfyTime(totalHours, totalMinutes)
	};
};

const addTimeEntry = timeEntry => async (token) => {
	const cookieJar = cookieJarFactory(token);
	let { phaseId, activityId } = timeEntry;
	if (!timeEntry.phaseId || !timeEntry.activityId) {
		const phaseOptions = await phases(token);
		const defaultPhaseId = phaseOptions.default;
		phaseId = phaseId || defaultPhaseId;

		const activityOptions = await activities(token, phaseId);
		const defaultActivityId = activityOptions.default;
		activityId = activityId || defaultActivityId;
	}

	const { personId, formKey } = await getUserDetails(cookieJar);

	const options = getOptions('POST', `${ACHIEVO_URL}/dlabs/timereg/newhours_insert.php`, cookieJar);
	const payload = {
		...commonPayload(personId, formKey, 'timereg_insert'),
		...activityToPayload(timeEntry, phaseId, activityId)
	};

	options.formData = payload;

	const body = await rp(options);
	let error = extractError(body);
	if (error) {
		throw error;
	}
	logger.info('Time keeped!!!');

	options.formData = { ...payload, function: 'insert_break' };

	const timeBreakHTML = await rp(options);

	error = extractError(timeBreakHTML);
	if (error) {
		throw error;
	}

	logger.info('Time break registered!!!');

	const response = await dailyEntries(timeEntry.date)(token);

	return response;
};

const delTimeEntry = async (token, id) => {
	const cookieJar = cookieJarFactory(token);

	let options = getOptions('GET', `${ACHIEVO_URL}/dlabs/timereg/newhours_delete.php`, cookieJar);
	const deleteFormHtml = await rp({
		...options,
		qs: { id }
	});
	let error = extractError(deleteFormHtml);
	if (error) {
		throw error;
	}
	const $ = cheerio.load(deleteFormHtml);
	const formKey = $('input[type="hidden"][name="form_key"]').val();
	const personId = $('select[name="person"]').val();

	options = getOptions('POST', `${ACHIEVO_URL}/dlabs/timereg/timereg_lib.php`, cookieJar);
	const payload = {
		id,
		form_key: formKey,
		person: personId,
		init_userid: personId,
		function: 'timereg_delete'
	};

	options.formData = payload;

	const deleteResponseHtml = await rp(options);
	error = extractError(deleteResponseHtml);
	if (error) {
		throw error;
	}

	logger.info('Time deleted!!!');

	return true;
};

module.exports = {
	login,
	logout,
	addTimeEntry,
	delTimeEntry,
	dailyEntries,
	weekEntriesByDate,
	activities,
	phases,
	userDetails
};
