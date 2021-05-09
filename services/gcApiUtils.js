'use strict';

/*
------------------------------------------------------------------------------
* Copyright 2021 JSM@Genesys.com, Inc. or its affiliates. All Rights Reserved.
------------------------------------------------------------------------------
*/

const { retry } = require('@lifeomic/attempt');
const platformClient = require('purecloud-platform-client-v2');

// Genesys Cloud - Script/API Settings
const GC_MaxItemsPerPage = 50;
// Genesys Cloud Search API allows a maximum of 50 values in the Query values array attribute
const GC_MaxFieldValuesPerPage = 50;
const GC_MaxItemsPerBulkACD = 90;
const GC_MaxItemsPerUserQueues = 25;
const GC_MaxRoleNamesPerPage = 10;
// Forcing API rate Delay (avoid/reduce hits on API Rate limit)
// - 0 milliseconds: No initial delay
// - or Initial Delay imposed by API Rate Control
// Ex: 250 - rate at 240 per minute, 350 - rate at 170 per minute
// const GC_DelayAPIRateControl = 350;
const GC_DelayAPIRateControl = 100;
const GC_MaxRateLimitRetryAttempts = 2;
// Search Method: 1 (using q64), 2 (using pageNumber)
const GC_SEARCH_METHOD = 1;
// Remove Duplicates: 0 (disabled), 1 (sarting at 2nd page only), 2 (always)
const GC_REMOVE_DUPLICATES = 1;

// Debug
const GC_DEBUG = true;

//#region Search With Query Filters

async function searchQueryPageWithNumber(searchUsingApi, pageNumber, searchExpandList, searchQueryFields, searchQueryValues, includeUsers, overrideQuery) {

    let searchBody = {
        'pageNumber': pageNumber,
        'pageSize': GC_MaxItemsPerPage,
        'sortOrder': 'ASC',
        'sortBy': 'id',
        'query': []
    };

    if (searchExpandList && searchExpandList.length > 0) {
        searchBody.expand = searchExpandList;
    }
    if (overrideQuery && overrideQuery.length > 0) {
        // Take first 9 - max number of filters in query is 10
        for (let i = 0; i < overrideQuery.length && i < 9; i++) {
            searchBody.query.push(overrideQuery[i]);
        }
    } else if ((searchQueryFields && searchQueryFields.length > 0) && (searchQueryValues && searchQueryValues.length > 0)) {
        searchBody.query = [
            {
                'fields': [],
                'values': [],
                'type': 'EXACT'
            }
        ];
        if (searchQueryFields && searchQueryFields.length > 0) {
            searchBody.query[0].fields = searchQueryFields;
        }
        if (searchQueryValues && searchQueryValues.length > 0) {
            searchBody.query[0].values = searchQueryValues;
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

        // lifeomic/attempt - calculating next delay in handleError
        const result = await retry(
            async () => {
                if (GC_DEBUG) console.log('Search Page Request at: ', Date.now());
                if (searchUsingApi === 'users') {
                    // if (includeUsers && includeUsers.length > 0 && ((includeUsers.length === 1 && includeUsers[0] != 'active') || (includeUsers.length > 1))) {
                    if (includeUsers && includeUsers.length > 0) {
                        searchBody.query.push({
                            'fields': ['state'],
                            'values': includeUsers,
                            'type': 'EXACT'
                        });
                    }
                    return await usersApi.postUsersSearch(searchBody);
                } else if (searchUsingApi === 'groups') {
                    return await groupsApi.postGroupsSearch(searchBody);
                } else if (searchUsingApi === 'locations') {
                    return await locationsApi.postLocationsSearch(searchBody);
                } else if (searchUsingApi === 'roles') {
                    let searchRolesOpts = {
                        'pageSize': GC_MaxItemsPerPage,
                        'pageNumber': pageNumber,
                        'name': searchQueryValues.toString()
                    };
                    return await authorizationApi.getAuthorizationRoles(searchRolesOpts);
                } else if (searchUsingApi === 'roleMembers') {
                    // one role at a time - searchQueryValues should contain one item only
                    let searchRoleId = searchQueryValues[0];
                    let searchRoleMembersOpts = {
                        'pageSize': GC_MaxItemsPerPage,
                        'pageNumber': pageNumber
                    };
                    return await authorizationApi.getAuthorizationRoleUsers(searchRoleId, searchRoleMembersOpts);
                }
            }, {
            maxAttempts: GC_MaxRateLimitRetryAttempts,
            timeout: 1000,
            async handleError(error, context) {
                console.log('Search Page Request handling error at: ', error);
                if (error.status == 429) {
                    // Managing API Rate Limit error
                    // Compute delay before retry based on retry-after header value (in seconds)
                    if (error.headers && error.headers.hasOwnProperty('retry-after')) {
                        let retryAfter = parseInt(error.headers['retry-after']);
                        // Add 1 second (retry-after is rounded to seconds) and convert to milliseconds
                        retryDelay = (retryAfter + 1) * 1000;
                    } else {
                        context.abort();
                    }
                } else {
                    // Interrupt application on other errors (401, 50x, ...)
                    context.abort();
                }
            },
            calculateDelay(context, options) {
                return retryDelay;
            }
        });

        return result;
    } catch (err) {
        console.error(`Error - searchPage - while getting page: ${JSON.stringify(err, null, 4)}`);
        return null;
    }
};

async function searchQueryPageWithQ64(searchUsingApi, q64Value, searchExpandList) {

    let searchOpts = {};

    if (searchExpandList && searchExpandList.length > 0) {
        searchOpts.expand = searchExpandList;
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
                if (searchUsingApi === 'users') {
                    return await usersApi.getUsersSearch(q64Value, searchOpts);
                } else if (searchUsingApi === 'groups') {
                    return await groupsApi.getGroupsSearch(q64Value, searchOpts);
                } else if (searchUsingApi === 'locations') {
                    return await locationsApi.getLocationsSearch(q64Value, searchOpts);
                }
            }, {
            maxAttempts: GC_MaxRateLimitRetryAttempts,
            timeout: 1000,
            async handleError(error, context) {
                if (error.status == 429) {
                    // Managing API Rate Limit error
                    // Compute delay before retry based on retry-after header value (in seconds)
                    if (error.headers && error.headers.hasOwnProperty('retry-after')) {
                        let retryAfter = parseInt(error.headers['retry-after']);
                        // Add 1 second (retry-after is rounded to seconds) and convert to milliseconds
                        retryDelay = (retryAfter + 1) * 1000;
                    } else {
                        context.abort();
                    }
                } else {
                    // Interrupt application on other errors (401, 50x, ...)
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

async function searchQueryAllPages(searchUsingApi, searchExpandList, searchQueryFields, searchQueryValues, includeUsers, overrideQuery, searchMethod) {
    let searchResults = [];

    let isLastPage = false;
    let isSuccessful = false;
    let nextPage = null;
    let nextPageQ64 = null;
    let pageIndex = -1;

    // Get First Page
    pageIndex = 1;
    const searchFirstPage = await searchQueryPageWithNumber(searchUsingApi, pageIndex, searchExpandList, searchQueryFields, searchQueryValues, includeUsers, overrideQuery);

    if (searchFirstPage != null) {
        // It is possible that a response contain less results than requested (even zero)
        if (searchFirstPage.results && searchFirstPage.results.length > 0) {
            // Clone each result to keep the data immutable
            searchFirstPage.results
                .forEach((result) => { searchResults.push(JSON.parse(JSON.stringify(result))); });
        } else if (searchFirstPage.entities && searchFirstPage.entities.length > 0) {
            // Clone each result to keep the data immutable
            searchFirstPage.entities
                .forEach((result) => { searchResults.push(JSON.parse(JSON.stringify(result))); });
        }
        if (searchMethod == 1) {
            // If there are more results to scan than returned in the current page, a next page with Q64 value will be provided in the response (nextPage).
            // For each response a new nextPage will be provided to be used in the next request.
            if (searchFirstPage.hasOwnProperty('nextPage')) {
                nextPage = searchFirstPage.nextPage;
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
            if (searchFirstPage.pageCount > pageIndex) {
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

    while (isLastPage === false) {
        let searchPage;
        if (searchMethod == 1) {
            searchPage = await searchQueryPageWithQ64(searchUsingApi, nextPageQ64, searchExpandList);
        } else {
            searchPage = await searchQueryPageWithNumber(searchUsingApi, pageIndex, searchExpandList, searchQueryFields, searchQueryValues, includeUsers, overrideQuery);
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
            if (searchMethod == 1) {
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
async function searchAllPages(searchList, searchMaxItems, searchUsingApi, searchExpandList, searchQueryFields, includeUsers, overrideQuery) {

    if (searchList.length > searchMaxItems) {
        console.log(`ToolError: The Search List contains more items (${searchList.length}) than the maximum authorized (${searchMaxItems})`);
        return null;
    }

    // Iterating on searchList because of GC_MaxFieldValuesPerPage
    let aggregatedSearchResults = [];

    for (let i = 0; i < searchList.length; i += GC_MaxFieldValuesPerPage) {
        // create/extract fields values
        let searchQueryValues = [];
        for (let j = 0; j < GC_MaxFieldValuesPerPage && (i + j) < searchList.length; j++) {
            searchQueryValues.push(searchList[i + j].id);
        }

        let searchQueryResult = await searchQueryAllPages(searchUsingApi, searchExpandList, searchQueryFields, searchQueryValues, includeUsers, overrideQuery, GC_SEARCH_METHOD);

        if (searchQueryResult && searchQueryResult.length > 0) {
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
        } else {
            console.log(`ToolDebug: searchAllPages - Loop - none found`);
        }
    }

    return aggregatedSearchResults;
}

async function searchAllPagesWithRoles(searchList, searchMaxItems) {

    if (searchList.length > searchMaxItems) {
        console.log(`ToolError: The Search List contains more items (${searchList.length}) than the maximum authorized (${searchMaxItems})`);
        return null;
    }

    // Iterating on searchList because of GC_MaxRoleNamesPerPage
    let aggregatedSearchResults = [];
    let aggregatedRolesResults = [];

    for (let i = 0; i < searchList.length; i += GC_MaxRoleNamesPerPage) {
        // create/extract fields values
        let searchRoleValues = [];
        for (let j = 0; j < GC_MaxRoleNamesPerPage && (i + j) < searchList.length; j++) {
            searchRoleValues.push(searchList[i + j].id);
        }

        let searchRolesResult = await searchQueryAllPages('roles', null, null, searchRoleValues, null, null, 2);

        if (searchRolesResult && searchRolesResult.length > 0) {
            // Remove duplicates
            if (GC_REMOVE_DUPLICATES == 1) {
                if (i > 0) {
                    // not the first page
                    searchRolesResult.forEach((result) => {
                        let foundIndex = aggregatedRolesResults.findIndex(element => element.id === result.id);
                        if (foundIndex == -1) {
                            // Not a duplicate
                            aggregatedRolesResults.push(result);
                        } else {
                            // Duplicate found - ignore
                        }
                    });
                } else {
                    aggregatedRolesResults.push(...searchRolesResult);
                }
            } else if (GC_REMOVE_DUPLICATES == 2) {
                searchRolesResult.forEach((result) => {
                    let foundIndex = aggregatedRolesResults.findIndex(element => element.id === result.id);
                    if (foundIndex == -1) {
                        // Not a duplicate
                        aggregatedRolesResults.push(result);
                    } else {
                        // Duplicate found - ignore
                        console.log(`Duplicate found id=${result.id} - ignoring.`);
                    }
                });
            } else {
                // GC_REMOVE_DUPLICATES == 0 (Default)
                aggregatedRolesResults.push(...searchRolesResult);
            }
        } else {
            console.log(`ToolDebug: searchAllPages - Loop - none found`);
        }
    }

    if (aggregatedRolesResults && aggregatedRolesResults.length > 0) {
        for (let k = 0; k < aggregatedRolesResults.length; k++) {

            let searchRoleMembersResult = await searchQueryAllPages('roleMembers', null, null, [aggregatedRolesResults[k].id], null, null, 2);

            if (searchRoleMembersResult && searchRoleMembersResult.length > 0) {
                // Remove duplicates
                if (GC_REMOVE_DUPLICATES == 1) {
                    if (k > 0) {
                        // not the first page
                        searchRoleMembersResult.forEach((result) => {
                            let foundIndex = aggregatedSearchResults.findIndex(element => element.id === result.id);
                            if (foundIndex == -1) {
                                // Not a duplicate
                                aggregatedSearchResults.push(result);
                            } else {
                                // Duplicate found - ignore
                            }
                        });
                    } else {
                        aggregatedSearchResults.push(...searchRoleMembersResult);
                    }
                } else if (GC_REMOVE_DUPLICATES == 2) {
                    searchRoleMembersResult.forEach((result) => {
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
                    aggregatedSearchResults.push(...searchRoleMembersResult);
                }
            } else {
                console.log(`ToolDebug: searchAllPages - Loop - none found`);
            }
        }
    } else {
        console.log(`ToolError: No identified role.`);
        return null;
    }

    return aggregatedSearchResults;
}

//#endregion


//#region Extended User Profile and Resolve

async function getUserAdjacents(userId) {

    try {
        // initialDelay:
        let retryDelay = GC_DelayAPIRateControl;

        let usersApi = new platformClient.UsersApi();

        // lifeomic/attempt - calculating next delay in handleError
        const result = await retry(
            async () => {
                if (GC_DEBUG) console.log('getUserAdjacents at: ', Date.now(), ' for user id: ', userId);
                let opts = {};
                return await usersApi.getUserAdjacents(userId, opts);
            }, {
            maxAttempts: GC_MaxRateLimitRetryAttempts,
            timeout: 1000,
            async handleError(error, context) {
                console.log('getUserAdjacents handling error at: ', error);
                if (error.status == 429) {
                    // Managing API Rate Limit error
                    // Compute delay before retry based on retry-after header value (in seconds)
                    if (error.headers && error.headers.hasOwnProperty('retry-after')) {
                        let retryAfter = parseInt(error.headers['retry-after']);
                        // Add 1 second (retry-after is rounded to seconds) and convert to milliseconds
                        retryDelay = (retryAfter + 1) * 1000;
                    } else {
                        context.abort();
                    }
                } else {
                    // Interrupt application on other errors (401, 50x, ...)
                    context.abort();
                }
            },
            calculateDelay(context, options) {
                return retryDelay;
            }
        });

        return result;
    } catch (err) {
        console.error(`Error - getUserAdjacents: ${JSON.stringify(err, null, 4)}`);
        return null;
    }
};

async function getUserPhoneAlertTimeout(userId) {

    try {
        // initialDelay:
        let retryDelay = GC_DelayAPIRateControl;

        let voicemailApi = new platformClient.VoicemailApi();

        // lifeomic/attempt - calculating next delay in handleError
        const result = await retry(
            async () => {
                if (GC_DEBUG) console.log('getUserPhoneAlertTimeout at: ', Date.now(), ' for user id: ', userId);
                return await voicemailApi.getVoicemailUserpolicy(userId);
            }, {
            maxAttempts: GC_MaxRateLimitRetryAttempts,
            timeout: 1000,
            async handleError(error, context) {
                console.log('getUserPhoneAlertTimeout handling error at: ', error);
                if (error.status == 429) {
                    // Managing API Rate Limit error
                    // Compute delay before retry based on retry-after header value (in seconds)
                    if (error.headers && error.headers.hasOwnProperty('retry-after')) {
                        let retryAfter = parseInt(error.headers['retry-after']);
                        // Add 1 second (retry-after is rounded to seconds) and convert to milliseconds
                        retryDelay = (retryAfter + 1) * 1000;
                    } else {
                        context.abort();
                    }
                } else {
                    // Interrupt application on other errors (401, 50x, ...)
                    context.abort();
                }
            },
            calculateDelay(context, options) {
                return retryDelay;
            }
        });

        return result;
    } catch (err) {
        console.error(`Error - getUserPhoneAlertTimeout: ${JSON.stringify(err, null, 4)}`);
        return null;
    }
}

async function getUserRolesDivisions(userId) {

    try {
        // initialDelay:
        let retryDelay = GC_DelayAPIRateControl;

        let usersApi = new platformClient.UsersApi();

        // lifeomic/attempt - calculating next delay in handleError
        const result = await retry(
            async () => {
                if (GC_DEBUG) console.log('getUserRolesDivisions at: ', Date.now(), ' for user id: ', userId);
                let opt = {};
                return await usersApi.getAuthorizationSubject(userId);
            }, {
            maxAttempts: GC_MaxRateLimitRetryAttempts,
            timeout: 1000,
            async handleError(error, context) {
                console.log('getUserRolesDivisions handling error at: ', error);
                if (error.status == 429) {
                    // Managing API Rate Limit error
                    // Compute delay before retry based on retry-after header value (in seconds)
                    if (error.headers && error.headers.hasOwnProperty('retry-after')) {
                        let retryAfter = parseInt(error.headers['retry-after']);
                        // Add 1 second (retry-after is rounded to seconds) and convert to milliseconds
                        retryDelay = (retryAfter + 1) * 1000;
                    } else {
                        context.abort();
                    }
                } else {
                    // Interrupt application on other errors (401, 50x, ...)
                    context.abort();
                }
            },
            calculateDelay(context, options) {
                return retryDelay;
            }
        });

        return result;
    } catch (err) {
        console.error(`Error - getUserRolesDivisions: ${JSON.stringify(err, null, 4)}`);
        return null;
    }
}

async function getUserQueuesPage(userId, pageNumber) {

    try {
        // initialDelay:
        let retryDelay = GC_DelayAPIRateControl;

        let usersApi = new platformClient.UsersApi();

        // lifeomic/attempt - calculating next delay in handleError
        const result = await retry(
            async () => {
                if (GC_DEBUG) console.log('getUserQueuesPage at: ', Date.now(), ' for user id: ', userId, ' for page number: ', pageNumber);
                let opts = {
                    'pageSize': GC_MaxItemsPerUserQueues,
                    'pageNumber': pageNumber,
                };
                return await usersApi.getUserQueues(userId, opts);
            }, {
            maxAttempts: GC_MaxRateLimitRetryAttempts,
            timeout: 1000,
            async handleError(error, context) {
                console.log('getUserQueuesPage handling error at: ', error);
                if (error.status == 429) {
                    // Managing API Rate Limit error
                    // Compute delay before retry based on retry-after header value (in seconds)
                    if (error.headers && error.headers.hasOwnProperty('retry-after')) {
                        let retryAfter = parseInt(error.headers['retry-after']);
                        // Add 1 second (retry-after is rounded to seconds) and convert to milliseconds
                        retryDelay = (retryAfter + 1) * 1000;
                    } else {
                        context.abort();
                    }
                } else {
                    // Interrupt application on other errors (401, 50x, ...)
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

async function getUserQueues(userId) {

    let queues = [];

    let i = 1;
    let pageCount = 0;
    do {
        const queuePage = await getUserQueuesPage(userId, i);

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
}

async function resolveLocations(locationIds) {
    let resolvedLocationsMap = {};

    if (locationIds && locationIds.length > 0) {
        let settings = {
            maxItems: 100,
            usingApi: 'locations',
            expandList: [],
            queryFields: ['id']
        };

        let searchReqestList = locationIds.map(obj => {
            let rObj = {
                'id': obj
            };
            return rObj
        })

        let locationsResultList = await searchAllPages(searchReqestList, settings.maxItems, settings.usingApi, settings.expandList, settings.queryFields, null, null);

        if (locationsResultList) {
            locationsResultList.forEach((location) => { resolvedLocationsMap[location.id] = JSON.parse(JSON.stringify(location)); });
        }
    }

    return resolvedLocationsMap;
}

async function resolveGroups(groupIds) {

    let resolvedGroupsMap = {};

    if (groupIds && groupIds.length > 0) {
        let settings = {
            maxItems: 100,
            usingApi: 'groups',
            expandList: [],
            queryFields: ['id']
        };

        let searchReqestList = groupIds.map(obj => {
            let rObj = {
                'id': obj
            };
            return rObj
        })

        let groupsResultList = await searchAllPages(searchReqestList, settings.maxItems, settings.usingApi, settings.expandList, settings.queryFields, null, null);

        if (groupsResultList) {
            groupsResultList.forEach((group) => { resolvedGroupsMap[group.id] = JSON.parse(JSON.stringify(group)); });
        }
    }

    return resolvedGroupsMap;
}

async function resolveManagers(managerIds) {
    let resolvedManagersMap = {};

    if (managerIds && managerIds.length > 0) {
        let settings = {
            maxItems: 100,
            usingApi: 'users',
            expandList: [],
            queryFields: ['id']
        };

        let searchReqestList = managerIds.map(obj => {
            let rObj = {
                'id': obj
            };
            return rObj
        })

        let managersResultList = await searchAllPages(searchReqestList, settings.maxItems, settings.usingApi, settings.expandList, settings.queryFields, ["active", "inactive", "deleted"], null);

        if (managersResultList) {
            managersResultList.forEach((manager) => { resolvedManagersMap[manager.id] = JSON.parse(JSON.stringify(manager)); });
        }
    }

    return resolvedManagersMap;
}

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
                console.log('bulkUpdateACDAutoAnswer at: ', Date.now());
                return await usersApi.patchUsersBulk(requestBody);
            }, {
            maxAttempts: GC_MaxRateLimitRetryAttempts,
            timeout: 1000,
            async handleError(error, context) {
                console.log('bulkUpdateACDAutoAnswer handling error at: ', error);
                if (error.status == 429) {
                    // Managing API Rate Limit error
                    // Compute delay before retry based on retry-after header value (in seconds)
                    if (error.headers && error.headers.hasOwnProperty('retry-after')) {
                        let retryAfter = parseInt(error.headers['retry-after']);
                        // Add 1 second (retry-after is rounded to seconds) and convert to milliseconds
                        retryDelay = (retryAfter + 1) * 1000;
                    } else {
                        context.abort();
                    }
                } else {
                    // Interrupt application on other errors (401, 50x, ...)
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

// Public
async function changeACDAutoAnswer(usersList, autoAnswer) {

    let bulkInformation = {
        'input': usersList.length,
        'deleted': 0,
        'alreadySet': 0,
        'updated': 0
    };

    let bulkCount = 0;
    let bulkBody = [];
    for (let i = 0; i < usersList.length; i++) {
        // check users who are not deleted and who are onot already with this autoAnswer
        if (usersList[i].state === 'deleted') {
            bulkInformation.deleted++;
        } else {
            if (usersList[i].acdAutoAnswer != autoAnswer) {
                bulkBody.push({
                    'id': usersList[i].id,
                    'acdAutoAnswer': autoAnswer
                });
                bulkCount++;
                bulkInformation.updated++;
            } else {
                bulkInformation.alreadySet++;
            }
        }
        if (bulkCount >= GC_MaxItemsPerBulkACD) {
            // send bulk request
            let bulkUpdateResult = await bulkUpdateACDAutoAnswer(bulkBody);
            if (bulkUpdateResult) {
                bulkCount = 0;
                bulkBody = [];
            } else {
                // An error occured
                return null;
            };
        }
    }
    if (bulkCount > 0) {
        // send bulk request
        let bulkUpdateResult = await bulkUpdateACDAutoAnswer(bulkBody);
        if (bulkUpdateResult) {
            bulkCount = 0;
            bulkBody = [];
        } else {
            // An error occured
            return null;
        };
    }

    return bulkInformation;
}

//#endregion


/*
------------------------------------------------------------------------------
* Module Exports
------------------------------------------------------------------------------
*/

module.exports = {
    searchAllPages,
    searchAllPagesWithRoles,
    getUserAdjacents,
    getUserPhoneAlertTimeout,
    getUserRolesDivisions,
    getUserQueues,
    resolveLocations,
    resolveGroups,
    resolveManagers,
    changeACDAutoAnswer
};
