import React from 'react';
import PropTypes from 'prop-types';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

import strings from '../../shared/strings';

import '../styles/login.styl';

const SIGN_IN_MUTATION = gql`
  mutation signIn($user: String!, $password: String!) {
	signIn(user: $user, password: $password) {
	  token
	}
  }
`;

export const API_AUTH_TOKEN = 'achiever-auth-token';

class Login extends React.Component {
	constructor(props) {
		super(props);

		this.onSubmit = this.onSubmit.bind(this);

		this.state = {
			username: '',
			password: ''
		};
	}

	onChangeField(field) {
		return (event) => {
			this.setState({ [field]: event.target.value });
		};
	}

	onSubmit(event) {
		event.preventDefault();

		const { username, password } = this.state;

		this._signIn(username, password);
	}

	_shouldSubmitBeAvailable() {
		return this.state.username && this.state.password;
	}

	async _signIn(username, password) {
		let response;
		try {
			response = await this.props.signIn({
				variables: {
					user: username,
					password
				}
			});
		} catch (error) {
			console.error('Authentication failed!', error);
		}

		if (response) {
			console.log('Authenticated!!!');
			const { token } = response.data.signIn;
			localStorage.setItem(API_AUTH_TOKEN, token);
		}
	}

	render() {
		return (
			<div className="page-wrapper">
				<form onSubmit={this.onSubmit}>
					<h2 className="current-date">
						<strong>{strings.login}</strong>
					</h2>
					<div className="column">&nbsp;</div>
					<div className="column">
						<div className="time-management-content">
							<div className="login-field">
								<label htmlFor="username">{strings.username}</label>
								<input
									type="text"
									name="username"
									onChange={this.onChangeField('username')}
								/>
							</div>
							<div className="login-field">
								<label htmlFor="password">{strings.password}</label>
								<input
									type="password"
									name="password"
									onChange={this.onChangeField('password')}
								/>
							</div>
							<button
								type="submit"
								className="send"
								ref={(button) => { this.submitButton = button; }}
								disabled={!this._shouldSubmitBeAvailable()}
							>
								{strings.send}
							</button>
						</div>
					</div>
				</form>
			</div>
		);
	}
}

export default graphql(SIGN_IN_MUTATION, { name: 'signIn' })(Login);

Login.propTypes = {
	signIn: PropTypes.func.isRequired
};
