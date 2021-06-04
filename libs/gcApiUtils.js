'use strict';

/*
------------------------------------------------------------------------------
* Copyright 2021 JSM (Genesys.com), Inc. or its affiliates. All Rights Reserved.
------------------------------------------------------------------------------
*/

const { retry } = require('@lifeomic/attempt');
const platformClient = require('purecloud-platform-client-v2');

// Genesys Cloud - Script/API Settings
const GC_MaxItemsPerPage = 50;
const GC_MaxItemsPerUserQueues = 25;

// Forcing API rate Delay (avoid/reduce hits on API Rate limit)
// - 0 milliseconds: No initial delay
// - or Initial Delay imposed by API Rate Control
// Ex: 250 - rate at 240 per minute, 350 - rate at 170 per minute
// const GC_DelayAPIRateControl = 350;
const GC_DelayAPIRateControl = 100;
const GC_MaxRateLimitRetryAttempts = 2;

// Remove Duplicates: 0 (disabled), 1 (sarting at 2nd page only), 2 (always)
const GC_REMOVE_DUPLICATES = 1;

// Debug - 0 = none, 1 = simple debug, 2 = extended debug
let DEBUG_LEVEL = 1;
const setDebug = function (level) {
    DEBUG_LEVEL = level;
}

//#region Search With Query Filters

/*
// The first step is to identify and to retrieve the list of users (user profile information) based on the requested selection criteria (type: skill, email, ...)
//
// 1. Some of the selection types and their values can be leveraged directly, as a query search criteria, in a Users Search API request (POST /api/v2/users/search).
//    Ex:
//       - list of skill names, departments, languages, email, gcid, display name, ...
//       - custom filter
//
// 2. Some of the selection types and their values will first need to be "translated" (resolved into their GUID). The "translated" identifiers will then be leveraged, as a query search criteria, in a Users Search API request (POST /api/v2/users/search).
//    Ex:
//       - list of group names, locations, divisions --> to --> list of groupIds, locationIds, divisionsIds
//    The Users Search API request (POST /api/v2/users/search) only supports a query search criteria on the id of a group/location/division.
//
// 3. Selecting users by role (role names) is managed specifically. The Users Search API request does not support a query search criteria on role/roleId.
//    The role names first need to be resolved into roleIds.
//    For each of the roleIds, retrieve the users/subjects with this role --> list of userIds.
//    The userIds will then be leveraged, as a query search criteria, in a Users Search API request (POST /api/v2/users/search).
//
// The [Users Search API request (POST /api/v2/users/search) is limited to a maximum of 50 values in a single search criteria, and 50 to 100 items per page result](https://developer.genesys.cloud/api/rest/v2/search/search_limits).
//
*/

async function searchQueryPageWithNumber(pageNumber, searchQueryValues, searchSettings) {

    let searchBody = {
        'pageNumber': pageNumber,
        'pageSize': GC_MaxItemsPerPage,
        'sortOrder': 'ASC',
        'sortBy': 'id',
        'query': []
    };

    if (searchSettings.expandList && searchSettings.expandList.length > 0) {
        searchBody.expand = searchSettings.expandList;
    }
    if (searchSettings.customSearchCriteria && searchSettings.customSearchCriteria.length > 0) {
        // Take first 9 - max number of filters in query is 10
        for (let i = 0; i < searchSettings.customSearchCriteria.length && i < 9; i++) {
            searchBody.query.push(searchSettings.customSearchCriteria[i]);
        }
    } else if ((searchSettings.queryFields && searchSettings.queryFields.length > 0) && (searchQueryValues && searchQueryValues.length > 0)) {
        if (searchSettings.queryConditionsAsAnd == false) {
            searchBody.query = [
                {
                    'fields': [],
                    'values': [],
                    'type': 'EXACT'
                }
            ];
            searchBody.query[0].fields = searchSettings.queryFields;
            searchBody.query[0].values = searchQueryValues;
        } else {
            searchBody.query = [];
            searchQueryValues.forEach((queryValue) => {
                let queryFilter = {
                    'fields': searchSettings.queryFields,
                    'value': queryValue,
                    'type': 'EXACT'
                };
                searchBody.query.push(queryFilter);
            });
        }
    }

    try {
        // lifeomic/attempt request and retry delays logic (initial, fixed, exponential) is overriden by the calculateDelay function
        // On first run, the calculateDelay will return the initial delay (0 if you don't want to control API rate)
        // On HTTP error, the next delay will be retrieved if it is a HTTP 429 response, from the retry-after header (in seconds).
        // For other type of HTTP errors (401, 50x, ...), the script will just exit.

        // initialDelay:
        // - 0 milliseconds: No initial delay
        // - or Initial Delay imposed by API Rate Control
        // let retryDelay = initialDelay;
        let retryDelay = GC_DelayAPIRateControl;

        let usersApi = new platformClient.UsersApi();
        let groupsApi = new platformClient.GroupsApi();
        let locationsApi = new platformClient.LocationsApi();
        let authorizationApi = new platformClient.AuthorizationApi();
        let routingApi = new platformClient.RoutingApi();

        // lifeomic/attempt - calculating next delay in handleError
        const result = await retry(
            async () => {
                if (DEBUG_LEVEL >= 2) console.log('Search Page With Number Request at: ', Date.now());

                if (searchSettings.usingApi === 'users') {
                    if (searchSettings.includeUsers && searchSettings.includeUsers.length > 0) {
                        searchBody.query.push({
                            'fields': ['state'],
                            'values': searchSettings.includeUsers,
                            'type': 'EXACT'
                        });
                    }
                    return await usersApi.postUsersSearch(searchBody);
                } else if (searchSettings.usingApi === 'groups') {
                    if (searchSettings.groupsSearchMethod == 2) {
                        let getGroupsOpts = {
                            'pageSize': GC_MaxItemsPerPage,
                            'pageNumber': pageNumber,
                            'sortOrder': 'ASC'
                        };
                        return await groupsApi.getGroups(getGroupsOpts);
                    } else {
                        return await groupsApi.postGroupsSearch(searchBody);
                    }
                } else if (searchSettings.usingApi === 'locations') {
                    return await locationsApi.postLocationsSearch(searchBody);
                } else if (searchSettings.usingApi === 'skills') {
                    let searchSkillsOpts = {
                        'pageSize': GC_MaxItemsPerPage,
                        'pageNumber': pageNumber,
                        'name': searchQueryValues.toString()
                    };
                    return await routingApi.getRoutingSkills(searchSkillsOpts);
                } else if (searchSettings.usingApi === 'languages') {
                    let searchLanguagesOpts = {
                        'pageSize': GC_MaxItemsPerPage,
                        'pageNumber': pageNumber,
                        'sortOder': 'ASC',
                        'name': searchQueryValues.toString()
                    };
                    return await routingApi.getRoutingLanguages(searchLanguagesOpts);
                } else if (searchSettings.usingApi === 'divisions') {
                    let searchDivisionsOpts = {
                        'pageSize': GC_MaxItemsPerPage,
                        'pageNumber': pageNumber,
                        'name': searchQueryValues.toString()
                    };
                    let divisionsPage = await authorizationApi.getAuthorizationDivisions(searchDivisionsOpts);
                    return divisionsPage;
                } else if (searchSettings.usingApi === 'roles') {
                    let searchRolesOpts = {
                        'pageSize': GC_MaxItemsPerPage,
                        'pageNumber': pageNumber,
                        'name': searchQueryValues.toString()
                    };
                    return await authorizationApi.getAuthorizationRoles(searchRolesOpts);
                } else if (searchSettings.usingApi === 'roleMembers') {
                    // one role at a time - searchQueryValues should contain one item only
                    let searchRoleId = searchQueryValues[0];
                    let searchRoleMembersOpts = {
                        'pageSize': GC_MaxItemsPerPage,
                        'pageNumber': pageNumber
                    };
                    return await authorizationApi.getAuthorizationRoleUsers(searchRoleId, searchRoleMembersOpts);
                } else {
                    console.error(`Error - searchQueryPageWithNumber - Unsupported search api: ${searchSettings.usingApi}`);
                    return null;
                }
            }, {
            maxAttempts: GC_MaxRateLimitRetryAttempts,
            // timeout: 3000,
            async handleError(error, context) {
                if (error.status == 429) {
                    // Managing API Rate Limit error
                    // Compute delay before retry based on retry-after header value (in seconds)
                    if (error.headers && error.headers.hasOwnProperty('retry-after')) {
                        let retryAfter = parseInt(error.headers['retry-after']);
                        if (DEBUG_LEVEL >= 1) console.log(`Pause searchQueryPageWithNumber - API Rate Limit reached - The application will resume processing in ${retryAfter} seconds...`);
                        // Add 1 second (retry-after is rounded to seconds) and convert to milliseconds
                        retryDelay = (retryAfter + 1) * 1000;
                    } else {
                        console.log(`Abort searchQueryPageWithNumber - Platform API Request - Handling error (429 with no retry):`, error);
                        context.abort();
                    }
                } else {
                    // Interrupt application on other errors (401, 50x, ...)
                    console.log(`Abort searchQueryPageWithNumber - Platform API Request - Handling error (no retry):`, error);
                    context.abort();
                }
            },
            calculateDelay(context, options) {
                return retryDelay;
            }
        });

        return result;
    } catch (err) {
        console.error(`Error - searchQueryPageWithNumber - while getting page: ${JSON.stringify(err, null, 4)}`);
        return null;
    }
};

async function searchQueryPageWithQ64(q64Value, searchSettings) {

    let searchOpts = {};

    if (searchSettings.expandList && searchSettings.expandList.length > 0) {
        searchOpts.expand = searchSettings.expandList;
    }

    try {
        // lifeomic/attempt request and retry delays logic (initial, fixed, exponential) is overriden by the calculateDelay function
        // On first run, the calculateDelay will return the initial delay (0 if you don't want to control API rate)
        // On HTTP error, the next delay will be retrieved if it is a HTTP 429 response, from the retry-after header (in seconds).
        // For other type of HTTP errors (401, 50x, ...), the script will just exit.

        // initialDelay:
        // - 0 milliseconds: No initial delay
        // - or Initial Delay imposed by API Rate Control
        // let retryDelay = initialDelay;
        let retryDelay = GC_DelayAPIRateControl;

        let usersApi = new platformClient.UsersApi();
        let groupsApi = new platformClient.GroupsApi();
        let locationsApi = new platformClient.LocationsApi();

        // lifeomic/attempt - calculating next delay in handleError
        const result = await retry(
            async () => {
                console.log('Search Request (Q64) at: ', Date.now());
                if (searchSettings.usingApi === 'users') {
                    return await usersApi.getUsersSearch(q64Value, searchOpts);
                } else if (searchSettings.usingApi === 'groups') {
                    return await groupsApi.getGroupsSearch(q64Value, searchOpts);
                } else if (searchSettings.usingApi === 'locations') {
                    return await locationsApi.getLocationsSearch(q64Value, searchOpts);
                } else {
                    console.error(`Error - searchPageWithQ64 - Unsupported search api: ${searchSettings.usingApi}`);
                    return null;
                }
            }, {
            maxAttempts: GC_MaxRateLimitRetryAttempts,
            // timeout: 3000,
            async handleError(error, context) {
                if (error.status == 429) {
                    // Managing API Rate Limit error
                    // Compute delay before retry based on retry-after header value (in seconds)
                    if (error.headers && error.headers.hasOwnProperty('retry-after')) {
                        let retryAfter = parseInt(error.headers['retry-after']);
                        if (DEBUG_LEVEL >= 1) console.log(`Pause searchQueryPageWithQ64 - API Rate Limit reached - The application will resume processing in ${retryAfter} seconds...`);
                        // Add 1 second (retry-after is rounded to seconds) and convert to milliseconds
                        retryDelay = (retryAfter + 1) * 1000;
                    } else {
                        console.log(`Abort searchQueryPageWithQ64 - Platform API Request - Handling error (429 with no retry):`, error);
                        context.abort();
                    }
                } else {
                    // Interrupt application on other errors (401, 50x, ...)
                    console.log(`Abort searchQueryPageWithQ64 - Platform API Request - Handling error (no retry):`, error);
                    context.abort();
                }
            },
            calculateDelay(context, options) {
                return retryDelay;
            }
        });

        return result;
    } catch (err) {
        console.error(`Error - searchPageWithQ64 - while getting page with q64 = ${q64Value} : ${JSON.stringify(err, null, 4)}`);
        return null;
    }
};

async function searchQueryAllPages(searchQueryValues, searchSettings) {
    let searchResults = [];

    let isLastPage = false;
    let isSuccessful = false;
    let nextPage = null;
    let nextPageQ64 = null;
    let pageIndex = -1;

    // Get First Page
    pageIndex = 1;

    while (isLastPage === false) {
        let searchPage;
        if (searchSettings.paginationMethod == 2 || pageIndex == 1) {
            searchPage = await searchQueryPageWithNumber(pageIndex, searchQueryValues, searchSettings);
        } else {
            searchPage = await searchQueryPageWithQ64(nextPageQ64, searchSettings);
        }
        if (searchPage != null) {
            // It is possible that a response contain less results than requested (even zero)
            if (searchPage.results && searchPage.results.length > 0) {
                // Clone each result to keep the data immutable
                searchPage.results
                    .forEach((result) => { searchResults.push(JSON.parse(JSON.stringify(result))); });
            } else if (searchPage.entities && searchPage.entities.length > 0) {
                // Clone each result to keep the data immutable
                searchPage.entities
                    .forEach((result) => { searchResults.push(JSON.parse(JSON.stringify(result))); });
            }
            if (searchSettings.paginationMethod == 1) {
                // If there are more results to scan than returned in the current page, a next page with Q64 value will be provided in the response (nextPage).
                // For each response a new nextPage will be provided to be used in the next request.
                if (searchPage.hasOwnProperty('nextPage')) {
                    nextPage = searchPage.nextPage;
                    // Extract Q64 (and decode uri component)
                    let searchQueryParamsSeparator = 'search?';
                    let indexStartQueryParams = nextPage.indexOf(searchQueryParamsSeparator);

                    let queryParamsStr = nextPage.substr(indexStartQueryParams + searchQueryParamsSeparator.length);

                    let queryParams = queryParamsStr.split('&');
                    let q64Key = 'q64=';
                    for (let paramIndex in queryParams) {
                        if (queryParams[paramIndex].startsWith(q64Key)) {
                            let q64ValueRaw = queryParams[paramIndex].substr(q64Key.length);
                            nextPageQ64 = decodeURIComponent(q64ValueRaw);
                        }
                    }
                    isLastPage = false;
                } else {
                    // No nextPage - this is the last page of data
                    isLastPage = true;
                    isSuccessful = true;
                }
            } else {
                // If there are more results to scan than returned in the current page, a pageCount value will be provided in the response (pageCount > 1).
                if (searchPage.pageCount > pageIndex) {
                    pageIndex++;
                    isLastPage = false;
                } else {
                    // No next Page - this is the last page of data
                    isLastPage = true;
                    isSuccessful = true;
                }
            }
        } else {
            // Error during search - Exit application
            isLastPage = true;
            isSuccessful = false;
        }
    }

    if (isSuccessful) {
        return searchResults;
    }

    return null;
}

// Public
async function searchAllPages(inputList, searchSettings, verifyInput) {

    if (searchSettings.queryConditionsAsAnd == true) {
        // The search query can accomodate up to 10 filters - one is reserved for user's state
        searchSettings.maxItems = 9;
        searchSettings.maxValuesInCriteria = 9;
    }

    if (inputList.length > searchSettings.maxItems) {
        console.log(`ToolError: The Search List contains more items (${inputList.length}) than the maximum authorized (${searchSettings.maxItems})`);
        return null;
    }

    let aggregatedSearchResults = [];

    if (searchSettings.usingApi === 'divisions' && inputList.length == 0) {
        // Get all divisions
        let searchQueryResult = await searchQueryAllPages([], searchSettings);
        aggregatedSearchResults.push(...searchQueryResult);
    } else if (searchSettings.usingApi === 'groups' && searchSettings.groupsSearchMethod == 2) {
        // This type of request is managed specifically - Search does not bring back groups in Members Only visibility
        // Alternative: Get all Groups and compare to input list

        // Get all groups
        let searchQueryResult = await searchQueryAllPages([], searchSettings);

        if (searchQueryResult && searchQueryResult.length > 0) {
            // Compare list of groups (all) to the input list (id attribute contains name of group or id of group)
            if (searchSettings.queryFields.includes('name')) {
                searchQueryResult.forEach((result) => {
                    let foundIndex = inputList.findIndex(element => element.id === result.name);
                    if (foundIndex > -1) {
                        // Matches one of the inputs
                        aggregatedSearchResults.push(result);
                    }
                });
            } else {
                // Used in resolve groups
                // searchSettings.queryFields.includes('id')
                searchQueryResult.forEach((result) => {
                    let foundIndex = inputList.findIndex(element => element.id === result.id);
                    if (foundIndex > -1) {
                        // Matches one of the inputs
                        aggregatedSearchResults.push(result);
                    }
                });

            }
        }
    } else {
        // Iterating on inputList because of searchSettings.maxValuesInCriteria
        for (let i = 0; i < inputList.length; i += searchSettings.maxValuesInCriteria) {
            // create/extract fields values
            let searchQueryValues = [];
            for (let j = 0; j < searchSettings.maxValuesInCriteria && (i + j) < inputList.length; j++) {
                searchQueryValues.push(inputList[i + j].id);
            }

            let searchQueryResult = await searchQueryAllPages(searchQueryValues, searchSettings);

            if (searchQueryResult && searchQueryResult.length > 0) {

                if (searchSettings.usingApi === 'skills' || searchSettings.usingApi === 'languages') {
                    // Searching skills and languages is meant for verification only
                    // The skill name and language name are still the token to use in a search criteria
                    searchQueryResult.forEach((result) => {
                        let foundIndex = aggregatedSearchResults.findIndex(element => element.id === result.name);
                        if (foundIndex == -1) {
                            // Not a duplicate
                            aggregatedSearchResults.push({ 'id': result.name });
                        } else {
                            // Duplicate found - ignore
                        }
                    });
                } else {
                    // Remove duplicates
                    if (GC_REMOVE_DUPLICATES == 1) {
                        if (i > 0) {
                            // not the first page
                            searchQueryResult.forEach((result) => {
                                let foundIndex = aggregatedSearchResults.findIndex(element => element.id === result.id);
                                if (foundIndex == -1) {
                                    // Not a duplicate
                                    aggregatedSearchResults.push(result);
                                } else {
                                    // Duplicate found - ignore
                                }
                            });
                        } else {
                            aggregatedSearchResults.push(...searchQueryResult);
                        }
                    } else if (GC_REMOVE_DUPLICATES == 2) {
                        searchQueryResult.forEach((result) => {
                            let foundIndex = aggregatedSearchResults.findIndex(element => element.id === result.id);
                            if (foundIndex == -1) {
                                // Not a duplicate
                                aggregatedSearchResults.push(result);
                            } else {
                                // Duplicate found - ignore
                                console.log(`Duplicate found id=${result.id} - ignoring.`);
                            }
                        });
                    } else {
                        // GC_REMOVE_DUPLICATES == 0 (Default)
                        aggregatedSearchResults.push(...searchQueryResult);
                    }
                }
            } else {
                console.log(`ToolDebug: searchAllPages - Loop - none found`);
            }
        }
    }

    if (DEBUG_LEVEL >= 1) {
        console.log(`DEBUG - Searching for ${searchSettings.usingApi}.`);
        console.log(`DEBUG - Search List has ${inputList.length} values.`);
        console.log(`DEBUG - Search Result has ${aggregatedSearchResults.length} values.`);
    }
    if (DEBUG_LEVEL == 2) {
        console.log(`DEBUG - Search List Values:`, inputList);
        console.log(`DEBUG - Search Result Values:`, aggregatedSearchResults);
    }

    if (verifyInput > 0) {
        // searchSettings.usingApi: groups, skills, languages, divisions, locations, tbd - roles, tbd - managers
        let apiToVerify = ['groups', 'skills', 'languages', 'divisions', 'locations', 'roles'];
        if (apiToVerify.includes(searchSettings.usingApi)) {
            if (inputList.length != aggregatedSearchResults.length) {
                console.log(`ToolWarning: verify input ${searchSettings.usingApi} - Number of input values (${inputList.length}) does not match the number of results (${aggregatedSearchResults.length}).`);
                if (DEBUG_LEVEL >= 1) {
                    let unknownEntities = [];
                    if (searchSettings.usingApi === 'skills' || searchSettings.usingApi === 'languages') {
                        inputList.forEach((inputEntity) => {
                            let foundIndex = aggregatedSearchResults.findIndex(element => element.id === inputEntity.id);
                            if (foundIndex == -1) {
                                // Not found
                                unknownEntities.push(inputEntity.id);
                            }
                        });
                    } else {
                        inputList.forEach((inputEntity) => {
                            let foundIndex = aggregatedSearchResults.findIndex(element => element.name === inputEntity.id);
                            if (foundIndex == -1) {
                                // Not found
                                unknownEntities.push(inputEntity.id);
                            }
                        });
                    }
                    console.log(`DEBUG - Unknown Input Values:`, unknownEntities);
                }
                if (verifyInput == 2) {
                    console.log(`ToolError: Tool is configured to exit if an input value is unknown/not found - Exiting...`);
                    return null;
                }
            } else {
                // as many input as results
                // do nothing
            }
        }
    } else {
        // verifyInput == 0
        // do nothing
    }

    return aggregatedSearchResults;
}

//#endregion

//#region Extended User Profile

async function getUserQueuesPageWithNumber(userId, pageNumber) {

    try {
        // initialDelay:
        let retryDelay = GC_DelayAPIRateControl;

        let usersApi = new platformClient.UsersApi();

        // lifeomic/attempt - calculating next delay in handleError
        const result = await retry(
            async () => {
                if (DEBUG_LEVEL >= 2) console.log('getUserQueuesPage at: ', Date.now(), ' for user id: ', userId, ' for page number: ', pageNumber);
                let opts = {
                    'pageSize': GC_MaxItemsPerUserQueues,
                    'pageNumber': pageNumber,
                };
                return await usersApi.getUserQueues(userId, opts);
            }, {
            maxAttempts: GC_MaxRateLimitRetryAttempts,
            // timeout: 3000,
            async handleError(error, context) {
                if (error.status == 429) {
                    // Managing API Rate Limit error
                    // Compute delay before retry based on retry-after header value (in seconds)
                    if (error.headers && error.headers.hasOwnProperty('retry-after')) {
                        let retryAfter = parseInt(error.headers['retry-after']);
                        if (DEBUG_LEVEL >= 1) console.log(`Pause getUserQueuesPageWithNumber - API Rate Limit reached - The application will resume processing in ${retryAfter} seconds...`);
                        // Add 1 second (retry-after is rounded to seconds) and convert to milliseconds
                        retryDelay = (retryAfter + 1) * 1000;
                    } else {
                        console.log(`Abort getUserQueuesPageWithNumber - Platform API Request - Handling error (429 with no retry):`, error);
                        context.abort();
                    }
                } else {
                    // Interrupt application on other errors (401, 50x, ...)
                    console.log(`Abort getUserQueuesPageWithNumber - Platform API Request - Handling error (no retry):`, error);
                    context.abort();
                }
            },
            calculateDelay(context, options) {
                return retryDelay;
            }
        });

        return result;
    } catch (err) {
        console.error(`Error - getUserQueuesPage: ${JSON.stringify(err, null, 4)}`);
        return null;
    }
}

// Public
// - queues
async function extendUserQueueInformation(userId) {
    let queues = [];

    let i = 1;
    let pageCount = 0;
    do {
        const queuePage = await getUserQueuesPageWithNumber(userId, i);

        if (queuePage != null) {
            pageCount = queuePage.pageCount;
            queues.push(queuePage.entities);
        }

        i++;
    }
    while (i <= pageCount);

    return queues
        .flat(1)
        .filter((queue) => queue != null);
};
// - rolesDivisions, adjacents, phoneAlertTimeouts
async function extendUserInformation(userId, infoType) {
    try {
        // initialDelay:
        let retryDelay = GC_DelayAPIRateControl;

        let usersApi = new platformClient.UsersApi();
        let voicemailApi = new platformClient.VoicemailApi();

        // lifeomic/attempt - calculating next delay in handleError
        const result = await retry(
            async () => {
                if (DEBUG_LEVEL >= 2) console.log('extendUserInformation at:', Date.now(), ' for user id:', userId, ' on type:', infoType);
                switch (infoType) {
                    case 'rolesDivisions':
                        return await usersApi.getAuthorizationSubject(userId);
                        break;
                    case 'adjacents':
                        return await usersApi.getUserAdjacents(userId, {});
                        break;
                    case 'phoneAlertTimeouts':
                        return await voicemailApi.getVoicemailUserpolicy(userId);
                        break;
                    default:
                        return null;
                        break;
                }
            }, {
            maxAttempts: GC_MaxRateLimitRetryAttempts,
            // timeout: 3000,
            async handleError(error, context) {
                if (error.status == 429) {
                    // Managing API Rate Limit error
                    // Compute delay before retry based on retry-after header value (in seconds)
                    if (error.headers && error.headers.hasOwnProperty('retry-after')) {
                        let retryAfter = parseInt(error.headers['retry-after']);
                        if (DEBUG_LEVEL >= 1) console.log(`Pause extendUserInformation - API Rate Limit reached - The application will resume processing in ${retryAfter} seconds...`);
                        // Add 1 second (retry-after is rounded to seconds) and convert to milliseconds
                        retryDelay = (retryAfter + 1) * 1000;
                    } else {
                        console.log(`Abort extendUserInformation - Platform API Request - Handling error (429 with no retry):`, error);
                        context.abort();
                    }
                } else {
                    // Interrupt application on other errors (401, 50x, ...)
                    console.log(`Abort extendUserInformation - Platform API Request - Handling error (no retry):`, error);
                    context.abort();
                }
            },
            calculateDelay(context, options) {
                return retryDelay;
            }
        });

        return result;
    } catch (err) {
        console.error(`Error - extendUserInformation: ${JSON.stringify(err, null, 4)}`);
        return null;
    }
};

//#endregion

//#region Bulk Update for ACD Auto-Answer

async function bulkUpdateACDAutoAnswer(requestBody) {

    try {
        // initialDelay:
        let retryDelay = GC_DelayAPIRateControl;

        let usersApi = new platformClient.UsersApi();

        // lifeomic/attempt - calculating next delay in handleError
        const result = await retry(
            async () => {
                if (DEBUG_LEVEL >= 2) console.log('bulkUpdateACDAutoAnswer at: ', Date.now());
                return await usersApi.patchUsersBulk(requestBody);
            }, {
            maxAttempts: GC_MaxRateLimitRetryAttempts,
            // timeout: 3000,
            async handleError(error, context) {
                if (error.status == 429) {
                    // Managing API Rate Limit error
                    // Compute delay before retry based on retry-after header value (in seconds)
                    if (error.headers && error.headers.hasOwnProperty('retry-after')) {
                        let retryAfter = parseInt(error.headers['retry-after']);
                        if (DEBUG_LEVEL >= 1) console.log(`Pause bulkUpdateACDAutoAnswer - API Rate Limit reached - The application will resume processing in ${retryAfter} seconds...`);
                        // Add 1 second (retry-after is rounded to seconds) and convert to milliseconds
                        retryDelay = (retryAfter + 1) * 1000;
                    } else {
                        console.log(`Abort bulkUpdateACDAutoAnswer - Platform API Request - Handling error (429 with no retry):`, error);
                        context.abort();
                    }
                } else {
                    // Interrupt application on other errors (401, 50x, ...)
                    console.log(`Abort bulkUpdateACDAutoAnswer - Platform API Request - Handling error (no retry):`, error);
                    context.abort();
                }
            },
            calculateDelay(context, options) {
                return retryDelay;
            }
        });

        return result;
    } catch (err) {
        console.error(`Error - bulkUpdateACDAutoAnswer: ${JSON.stringify(err, null, 4)}`);
        return null;
    }
};

//#endregion

//#region Bulk Update for roles

async function bulkRemoveRole(roleId, userIds) {

    try {
        // initialDelay:
        let retryDelay = GC_DelayAPIRateControl;

        let authorizationApi = new platformClient.AuthorizationApi();

        // lifeomic/attempt - calculating next delay in handleError
        const result = await retry(
            async () => {
                if (DEBUG_LEVEL >= 2) console.log('bulkRemoveRole at: ', Date.now());
                return await authorizationApi.putAuthorizationRoleUsersRemove(roleId, userIds);
            }, {
            maxAttempts: GC_MaxRateLimitRetryAttempts,
            // timeout: 3000,
            async handleError(error, context) {
                if (error.status == 429) {
                    // Managing API Rate Limit error
                    // Compute delay before retry based on retry-after header value (in seconds)
                    if (error.headers && error.headers.hasOwnProperty('retry-after')) {
                        let retryAfter = parseInt(error.headers['retry-after']);
                        if (DEBUG_LEVEL >= 1) console.log(`Pause bulkRemoveRole - API Rate Limit reached - The application will resume processing in ${retryAfter} seconds...`);
                        // Add 1 second (retry-after is rounded to seconds) and convert to milliseconds
                        retryDelay = (retryAfter + 1) * 1000;
                    } else {
                        console.log(`Abort bulkRemoveRole - Platform API Request - Handling error (429 with no retry):`, error);
                        context.abort();
                    }
                } else {
                    // Interrupt application on other errors (401, 50x, ...)
                    console.log(`Abort bulkRemoveRole - Platform API Request - Handling error (no retry):`, error);
                    context.abort();
                }
            },
            calculateDelay(context, options) {
                return retryDelay;
            }
        });

        return result;
    } catch (err) {
        console.error(`Error - bulkRemoveRole: ${JSON.stringify(err, null, 4)}`);
        return null;
    }
};

async function bulkAddRole(roleId, userIds, divisionIds) {

    try {
        // initialDelay:
        let retryDelay = GC_DelayAPIRateControl;

        let authorizationApi = new platformClient.AuthorizationApi();

        // lifeomic/attempt - calculating next delay in handleError
        const result = await retry(
            async () => {
                if (DEBUG_LEVEL >= 2) console.log('bulkAddRole at: ', Date.now());
                let body = {
                    "subjectIds": userIds,
                    "divisionIds": divisionIds,
                };
                let opts = {
                    'subjectType': 'PC_USER'
                };
                return await authorizationApi.postAuthorizationRole(roleId, body, opts);
            }, {
            maxAttempts: GC_MaxRateLimitRetryAttempts,
            // timeout: 3000,
            async handleError(error, context) {
                if (error.status == 429) {
                    // Managing API Rate Limit error
                    // Compute delay before retry based on retry-after header value (in seconds)
                    if (error.headers && error.headers.hasOwnProperty('retry-after')) {
                        let retryAfter = parseInt(error.headers['retry-after']);
                        if (DEBUG_LEVEL >= 1) console.log(`Pause bulkAddRole - API Rate Limit reached - The application will resume processing in ${retryAfter} seconds...`);
                        // Add 1 second (retry-after is rounded to seconds) and convert to milliseconds
                        retryDelay = (retryAfter + 1) * 1000;
                    } else {
                        console.log(`Abort bulkAddRole - Platform API Request - Handling error (429 with no retry):`, error);
                        context.abort();
                    }
                } else {
                    // Interrupt application on other errors (401, 50x, ...)
                    console.log(`Abort bulkAddRole - Platform API Request - Handling error (no retry):`, error);
                    context.abort();
                }
            },
            calculateDelay(context, options) {
                return retryDelay;
            }
        });

        return result;
    } catch (err) {
        console.error(`Error - bulkAddRole: ${JSON.stringify(err, null, 4)}`);
        return null;
    }
};

//#endregion

/*
------------------------------------------------------------------------------
* Module Exports
------------------------------------------------------------------------------
*/

module.exports = {
    setDebug,
    searchAllPages,
    extendUserQueueInformation,
    extendUserInformation,
    bulkUpdateACDAutoAnswer,
    bulkRemoveRole,
    bulkAddRole
};
