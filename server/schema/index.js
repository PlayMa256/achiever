const { makeExecutableSchema } = require('graphql-tools');
const resolvers = require('./resolvers');

const typeDefs = `
	input TimeEntryInput {
		date: String!,
		startTime: String!,
		endTime: String!,
		startBreakTime: String,
		endBreakTime: String,
		phaseId: Int,
		activityId: Int
	}

	type TimeEntryId {
		workTimeId: Int,
		breakTimeId: Int
	}

	type TimeEntry {
		id: TimeEntryId,
		date: String!,
		phase: String,
		activity: String,
		startTime: String,
		endTime: String,
		startBreakTime: String,
		endBreakTime: String,
		total: String
	}

	type WeekEntries {
		timeEntries: [TimeEntry]
		total: String
	}

	type Phase {
		id: Int,
		name: String
		activities: ActivityList
	}

	type PhaseList {
		default: Int,
		options: [Phase]
	}

	type Activity {
		id: Int,
		name: String
	}

	type ActivityList {
		default: Int,
		options: [Activity]
	}

	type Token {
		token: String
	}

	type UserDetails {
		name: String!
		dailyContractedHours: String!
		balance: String!
	}

	type Query {
		userDetails: UserDetails
		weekEntries(date: String!): WeekEntries
		phases: PhaseList
	}

	type Mutation {
		signIn(user: String!, password: String!): Token
		addTimeEntry(timeEntry: TimeEntryInput!): TimeEntry
		delTimeEntry(date: String!): Boolean
	}
`;

module.exports = makeExecutableSchema({ typeDefs, resolvers });
