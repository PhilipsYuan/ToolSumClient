import { getUserBenefitApi, getXHLVersion } from "../api/user";

let user = null
let userBenefit = null
let softVersion = null

export function getUser() {
    return user
}

export function setUser(info) {
    user = info
}

export function getUserBenefit() {
    if (userBenefit) {
        return Promise.resolve(userBenefit)
    } else {
        return getUserBenefitApi()
            .then((res) => {
                if (res.data.result) {
                    userBenefit = res.data.result
                    return userBenefit
                }
            })
    }
}

export function setUserBenefit() {
    return getUserBenefitApi()
        .then((res) => {
            if (res.data.result) {
                userBenefit = res.data.result
                return true
            }
        })
}

export function getSoftVersion() {
    if (softVersion) {
        return Promise.resolve(softVersion)
    } else {
        return getXHLVersion()
            .then((res) => {
                if (res.data.result) {
                    softVersion = res.data.result.version
                    return softVersion
                }
            })
    }
}