export type Task<T> = () => Promise<T>;

export function pool<T>(arrPromised: Task<T>[], count = 50): Promise<T[]> {
    return new Promise((resolve, reject) => {
        const length = arrPromised.length;
        if (length === 0) {
            resolve([]);
            return;
        }

        let current = 0;
        let active = 0;
        let error = null;
        let result: T[] = [];
        if (count > length) {
            count = length;
        }

        function done() {
            if (active <= 0) {
                return;
            }

            active--;
            if (active > 0) {
                return;
            }

            if (error) {
                reject(error);
                return;
            }

            if (current < arrPromised.length) {
                reject(new Error('Invalid done calling'));
                return;
            }
            resolve(result);
        }

        function onReject(err: any) {
            if (!error) {
                error = err;
            }
            done();
        }

        function createHandler(index: number) {
            return (value: T) => {
                if (error) {
                    done();
                    return;
                }

                result[index] = value;
                done();
                runNext();
            };
        }

        function runNext() {
            if (current >= arrPromised.length) {
                return;
            }

            arrPromised[current]().then(createHandler(current), onReject);
            active++;
            current++;
        }

        while (current < count) {
            runNext();
        }
    });
}

export function jsonParse(data: string): object {
    try {
        return JSON.parse(data);
    } catch (e) {
        return {};
    }
}
