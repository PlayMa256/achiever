import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { graphql } from 'react-apollo';

import * as queries from '../../queries.graphql';
import strings from '../../../shared/strings';
import { getAuthToken, removeAuthToken } from './token';
import { clearTodayStorage } from '../../utils';

import './UserDetails.styl';

const _logout = (event) => {
	event.preventDefault();
	removeAuthToken();
	clearTodayStorage();
	window.location.reload();
};

class UserDetails extends Component {
	constructor(props) {
		super(props);

		this.state = {
			authenticated: false
		};
	}

	componentWillReceiveProps(nextProps) {
		const { userDetails, loading, error } = nextProps.userDetailsQuery;

		if (error || (!loading && !userDetails)) {
			removeAuthToken();
			this.setState({ authenticated: false });
		} else {
			const token = getAuthToken();
			const authenticated = Boolean(token && userDetails.name);
			this.setState({ authenticated });
		}
	}

	render() {
		const { userDetails, loading, error } = this.props.userDetailsQuery;

		if (loading) {
			return <div>Loading...</div>;
		}

		const { authenticated } = this.state;

		if (authenticated && !error) {
			const [firstName] = userDetails.name.split(' ');

			return (
				<div className="user-details">
					<div className="employee-name">
						{`${strings.helloName} ${firstName}`}
					</div>
					<button className="logout" onClick={_logout}>
						{strings.logout}
					</button>
				</div>
			);
		}
		return null;
	}
}

export default graphql(queries.userDetails, { name: 'userDetailsQuery' })(UserDetails);

UserDetails.propTypes = {
	userDetailsQuery: PropTypes.object
};

UserDetails.defaultProps = {
	userDetailsQuery: {}
};
