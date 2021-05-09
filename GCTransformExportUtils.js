'use strict';

/*
------------------------------------------------------------------------------
* Copyright 2021 JSM@Genesys.com, Inc. or its affiliates. All Rights Reserved.
------------------------------------------------------------------------------
*/

//#region Sample input JSON User

/*
{
    "id": "xxxxxxxx-xxxx-1234-xxxx-xxxxxxxxxxxx",
    "name": "Sample User1",
    "division": {
        "id": "xxxxxxxx-xxxx-5678-xxxx-xxxxxxxxxxxx",
        "name": "Home",
        "selfUri": "/api/v2/authorization/divisions/xxxxxxxx-xxxx-5678-xxxx-xxxxxxxxxxxx"
    },
    "chat": {
        "jabberId": "5b36318bb9732b15426c6e01@devfoundry.orgspan.com"
    },
    "department": "Support",
    "email": "sampleuser1@domain.com",
    "primaryContactInfo": [
        {
            "address": "sampleuser1@domain.com",
            "mediaType": "EMAIL",
            "type": "PRIMARY"
        },
        {
            "address": "+33555555076",
            "mediaType": "SMS",
            "type": "PRIMARY"
        },
        {
            "address": "+33333333012",
            "display": "+33 3 33 33 30 12",
            "mediaType": "PHONE",
            "type": "PRIMARY"
        }
    ],
    "addresses": [
        {
            "address": "sample1@test.com",
            "mediaType": "EMAIL",
            "type": "WORK"
        },
        {
            "address": "+33555555076",
            "display": "+33 5 55 55 50 76",
            "mediaType": "SMS",
            "type": "MOBILE",
            "countryCode": "FR"
        },
        {
            "address": "+33333333012",
            "display": "+33 3 33 33 30 12",
            "mediaType": "SMS",
            "type": "WORK",
            "countryCode": "FR"
        },
        {
            "address": "+33444444065",
            "display": "+33 4 44 44 40 65",
            "mediaType": "SMS",
            "type": "WORK2",
            "countryCode": "FR"
        }
    ],
*** --> users with possible states from settings.selectUsers.active, settings.selectUsers.inactive, settings.selectUsers.deleted
    "state": "active",
    "title": "SDE, assad",
    "username": "sampleuser1@domain.com",
    "manager": {
        "id": "5fe7d07c-6036-4e8e-812d-5ee0828cb3f7",
        "selfUri": "/api/v2/users/5fe7d07c-6036-4e8e-812d-5ee0828cb3f7"
*** --> if settings.resolve.managers
        "name": ".....",
        "email": ".....",
        "department": ".....",
        "title": "....."
    },
    "images": [
        {
            "resolution": "x48",
            "imageUri": "https://prod-euw1-inin-directory-service-profile.s3-eu-west-1.amazonaws.com/c2d65552/19d0/4299/a1e5/041af64e8349.jpg"
        },
        {
            "resolution": "x96",
            "imageUri": "https://prod-euw1-inin-directory-service-profile.s3-eu-west-1.amazonaws.com/8b76e80c/37a2/45ac/8987/79fe67cbf74c.jpg"
        },
        {
            "resolution": "x128",
            "imageUri": "https://prod-euw1-inin-directory-service-profile.s3-eu-west-1.amazonaws.com/cf2f7f2a/f6c1/4886/96c0/e8375e902d64.jpg"
        },
        {
            "resolution": "x200",
            "imageUri": "https://prod-euw1-inin-directory-service-profile.s3-eu-west-1.amazonaws.com/5e534028/cc9a/4f00/8acb/ad55b20f6944.jpg"
        },
        {
            "resolution": "x300",
            "imageUri": "https://prod-euw1-inin-directory-service-profile.s3-eu-west-1.amazonaws.com/8fb6e28a/1e48/45f2/9a34/a8553c06327f.jpg"
        },
        {
            "resolution": "x400",
            "imageUri": "https://prod-euw1-inin-directory-service-profile.s3-eu-west-1.amazonaws.com/f96e49fc/6316/4213/8ca8/2b5ce0a33e4a.jpg"
        }
    ],
    "version": 169,
*** --> if settings.include.certifications
    "certifications": [
        "CertTest 01"
    ],
*** --> if settings.include.biography
    "biography": {
        "biography": "My biography",
        "interests": [
            "Cooking",
            "Metal"
        ],
        "hobbies": [
            "Guitar",
            "Computers"
        ],
        "spouse": "Name spouse",
        "education": [
            {
                "school": "School123",
                "fieldOfStudy": "Cooking",
                "notes": "Notes for the education info"
            }
        ]
    },
*** --> if settings.include.hr
    "employerInfo": {
        "officialName": "My HR Name",
        "employeeId": "My HR EmployeeID",
        "employeeType": "Full-time",
        "dateHire": "2020-06-08"
    },
*** --> if settings.include.roles
    "authorization": {
        "roles": [
            {
                "id": "b9d28b7e-7959-4789-b6c6-3a01ca8c856c",
                "name": "employee"
            },
            ...
        ],
        "permissions": [
            "acdscreenshare:chat:escalate",
            ...
        ],
        "permissionPolicies": [
            {
                "domain": "attributes",
                "entityName": "attribute",
                "allowConditions": false,
                "actionSet": [
                    "view"
                ]
            },
            ...
        ]
    },
*** --> if settings.include.profileSkills
    "profileSkills": [
        "English",
        "Javascript"
    ],
*** --> if settings.include.locations
    "locations": [
        {
            "coordinates": {},
            "notes": "",
            "locationDefinition": {
                "id": "596aaf1b-d62c-4d77-a55e-42e4f74114b6",
                "selfUri": "/api/v2/locations/596aaf1b-d62c-4d77-a55e-42e4f74114b6",
*** --> if settings.resolve.locations
                "name": "Paris"
            }
        }
    ],
*** --> if settings.include.groups
    "groups": [
        {
            "id": "95b0f898-6ce0-4fb0-aa3d-f70d8d178880",
            "selfUri": "/api/v2/groups/95b0f898-6ce0-4fb0-aa3d-f70d8d178880",
*** --> if settings.resolve.groups
            "name": "TestGroup",
            "memberCount": 5,
            "type": "official",
            "visibility": "public"
        },
        ...
    ],
*** --> if settings.include.skills
    "skills": [
        {
            "id": "ac7b42d7-b5d8-485c-8d95-474f43f13c00",
            "name": "TestSkill1",
            "proficiency": 1,
            "state": "active",
            "skillUri": "/api/v2/routing/skills/ac7b42d7-b5d8-485c-8d95-474f43f13c00",
            "selfUri": "/api/v2/users/xxxxxxxx-xxxx-1234-xxxx-xxxxxxxxxxxx/routingskills/ac7b42d7-b5d8-485c-8d95-474f43f13c00"
        },
        ...
    ],
*** --> if settings.include.languages
    "languages": [
        {
            "id": "8acdab08-7b2c-4ee3-a29b-9d116fa98833",
            "name": "English",
            "proficiency": 3,
            "state": "active",
            "languageUri": "/api/v2/routing/languages/8acdab08-7b2c-4ee3-a29b-9d116fa98833",
            "selfUri": "/api/v2/users/xxxxxxxx-xxxx-1234-xxxx-xxxxxxxxxxxx/routinglanguages/8acdab08-7b2c-4ee3-a29b-9d116fa98833"
        },
        ...
    ],
    "acdAutoAnswer": false,
*** --> if settings.include.languagePreference
    "languagePreference": "en-us",
    "selfUri": "/api/v2/users/xxxxxxxx-xxxx-1234-xxxx-xxxxxxxxxxxx",
*** --> if settings.extended.queues
    "queues": [
        {
            "id": "9ddf3a3a-e0c2-4833-8721-9431e14e7879",
            "name": "CX Queue",
            "joined": true,
            "selfUri": "/api/v2/routing/queues/9ddf3a3a-e0c2-4833-8721-9431e14e7879"
        },
        ...
    ],
*** --> if settings.extended.rolesDivisions
    "grants": [
        {
            "subjectId": "xxxxxxxx-xxxx-1234-xxxx-xxxxxxxxxxxx",
            "division": {
                "id": "e2a78444-8876-4398-a0e5-f6fd21e3698a",
                "name": "Home",
                "description": "My Description",
                "homeDivision": true,
                "selfUri": "/api/v2/authorization/divisions/e2a78444-8876-4398-a0e5-f6fd21e3698a"
            },
            "role": {
                "id": "b9d28b7e-7959-4789-b6c6-3a01ca8c856c",
                "name": "employee",
                "description": "Directory - Employee",
                "policies": [
                    {
                        "actions": [
                            "view"
                        ],
                        "domain": "attributes",
                        "entityName": "attribute"
                    },
                    ...
                ],
                "default": true,
                "selfUri": "/api/v2/authorization/roles/b9d28b7e-7959-4789-b6c6-3a01ca8c856c"
            }
        },
        ...
    ],
*** --> if settings.extended.managers
    "superiors": [
        {
            "id": "5fe7d07c-6036-4e8e-812d-5ee0828cb3f7",
            "name": "Supervisor3 DevFoundry",
            "chat": {
                "jabberId": "5fb224687440171996b538c7@devfoundry.orgspan.com"
            },
            "email": "supervisor3@test.com",
            "primaryContactInfo": [
                {
                    "address": "supervisor3@test.com",
                    "mediaType": "EMAIL",
                    "type": "PRIMARY"
                }
            ],
            "addresses": [],
            "state": "active",
            "username": "supervisor3@test.com",
            "version": 15,
            "acdAutoAnswer": false,
            "selfUri": "/api/v2/users/5fe7d07c-6036-4e8e-812d-5ee0828cb3f7"
        }
    ],
*** --> if settings.extended.directReports
    "directReports": [
        {
            "id": "de74aae8-2862-4b82-88d3-fb21e588bf34",
            "name": "Agent1 DevFoundry",
            "chat": {
                "jabberId": "5d3aacdb7f607f1905d0b247@devfoundry.orgspan.com"
            },
            "email": "agent1@test.test",
            "primaryContactInfo": [
                {
                    "address": "agent1@test.test",
                    "mediaType": "EMAIL",
                    "type": "PRIMARY"
                }
            ],
            "addresses": [],
            "state": "active",
            "username": "agent1@test.test",
            "manager": {
                "id": "xxxxxxxx-xxxx-1234-xxxx-xxxxxxxxxxxx",
                "selfUri": "/api/v2/users/xxxxxxxx-xxxx-1234-xxxx-xxxxxxxxxxxx"
            },
            "version": 54,
            "acdAutoAnswer": false,
            "selfUri": "/api/v2/users/de74aae8-2862-4b82-88d3-fb21e588bf34"
        },
        {
            "id": "c06293d8-2441-4a46-9629-ccce82ba5339",
            "name": "Agent2 DevFoundry",
            "chat": {
                "jabberId": "5e9dbe4981f65f14e87649fa@devfoundry.orgspan.com"
            },
            "email": "agent2@test.test",
            "primaryContactInfo": [
                {
                    "address": "agent2@test.test",
                    "mediaType": "EMAIL",
                    "type": "PRIMARY"
                }
            ],
            "addresses": [],
            "state": "active",
            "username": "agent2@test.test",
            "manager": {
                "id": "xxxxxxxx-xxxx-1234-xxxx-xxxxxxxxxxxx",
                "selfUri": "/api/v2/users/xxxxxxxx-xxxx-1234-xxxx-xxxxxxxxxxxx"
            },
            "version": 11,
            "acdAutoAnswer": false,
            "selfUri": "/api/v2/users/c06293d8-2441-4a46-9629-ccce82ba5339"
        }
    ],
*** --> if settings.extended.phoneAlertTimeouts
    "alertTimeoutSeconds": 20
}
*/

//#endregion

/*
------------------------------------------------------------------------------
* Transform JSON User for export
------------------------------------------------------------------------------
*/

//#region Transform to JSON

const jsonTransform = function (user, settings) {
    // TODO
    // Implement your function to transform collected User information to your own JSON format

    try {
        let transformedUser = { ...user };

        return transformedUser;
    } catch (err) {
        console.log(`Error - Ignoring json object - Proceeding...`);
        console.error(`Error: ${JSON.stringify(err, null, 4)}`);
        return null;
    }
}

//#endregion


//#region Transform to CSV

const csvTransformInit = function (settings) {

    // TODO
    // Implement your function to transform collected User information to your own CSV format

    // Return Headers (Column Names)
    let csvHeaders = ['id', 'email', 'name', 'title', 'department', 'state', 'autoAnswer'];

    return csvHeaders;
}

const csvTransform = function (user, settings) {

    // TODO
    // Implement your function to transform collected User information to your own CSV format

    // Return rown ["", "", "", ...]
    try {
        let csvRow = [
            user.id,
            user.email,
            user.name,
            user.title,
            user.department,
            user.state,
            user.acdAutoAnswer.toString()
        ];

        return csvRow;
    } catch (err) {
        console.log(`Error - Ignoring row - Proceeding...`);
        console.error(`Error: ${JSON.stringify(err, null, 4)}`);
        return null;
    }
}

//#endregion


/*
------------------------------------------------------------------------------
* Module Exports
------------------------------------------------------------------------------
*/

module.exports = {
    jsonTransform,
    csvTransformInit,
    csvTransform
};
