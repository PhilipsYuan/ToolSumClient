import { getUserBenefitApi } from "../api/user";

let user = null
let userBenefit = null

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